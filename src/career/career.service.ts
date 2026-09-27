import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CareerProfile } from './entities/career-profile.entity';
import { CareerScan, CareerScanStatus } from './entities/career-scan.entity';
import { UpdateCareerDto } from './dto/update-career.dto';
import { JobsService } from '../jobs/jobs.service';
import { JobSourceService } from '../jobs/job-source.service';
import { NetworkingService } from '../networking/networking.service';
import { CareerReportService } from './career-report.service';

/** IST calendar date (YYYY-MM-DD) — one scan per user per day. */
export function istDateString(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function istDisplayDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(now);
}

const STALE_RUNNING_MS = 30 * 60 * 1000;

@Injectable()
export class CareerService {
  private readonly logger = new Logger(CareerService.name);

  constructor(
    @InjectRepository(CareerProfile)
    private readonly profiles: Repository<CareerProfile>,
    @InjectRepository(CareerScan)
    private readonly scans: Repository<CareerScan>,
    private readonly jobs: JobsService,
    private readonly sources: JobSourceService,
    private readonly networking: NetworkingService,
    private readonly reporter: CareerReportService,
    private readonly config: ConfigService,
  ) {}

  async getOrCreateProfile(userId: string): Promise<CareerProfile> {
    let profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      profile = await this.profiles.save(
        this.profiles.create({ userId }),
      );
    }
    return profile;
  }

  async updateProfile(
    userId: string,
    dto: UpdateCareerDto,
  ): Promise<CareerProfile> {
    const profile = await this.getOrCreateProfile(userId);
    const list = (v: string[] | undefined) =>
      v === undefined
        ? undefined
        : [...new Set(v.map((s) => s.trim()).filter(Boolean))].slice(0, 50);
    if (dto.targetRoles !== undefined) profile.targetRoles = list(dto.targetRoles) ?? [];
    if (dto.skills !== undefined) profile.skills = list(dto.skills) ?? [];
    if (dto.experienceYears !== undefined)
      profile.experienceYears = dto.experienceYears;
    if (dto.location !== undefined) profile.location = dto.location?.trim() || null;
    if (dto.workTypes !== undefined)
      profile.workTypes = (list(dto.workTypes) ?? []).map((w) => w.toUpperCase());
    if (dto.salaryMin !== undefined) profile.salaryMin = dto.salaryMin;
    if (dto.salaryMax !== undefined) profile.salaryMax = dto.salaryMax;
    if (dto.currency !== undefined && dto.currency)
      profile.currency = dto.currency.trim().toUpperCase().slice(0, 8);
    if (dto.noticePeriodDays !== undefined)
      profile.noticePeriodDays = dto.noticePeriodDays;
    if (dto.employmentTypes !== undefined)
      profile.employmentTypes = list(dto.employmentTypes) ?? [];
    if (dto.targetCompanies !== undefined)
      profile.targetCompanies = list(dto.targetCompanies) ?? [];
    if (dto.excludedCompanies !== undefined)
      profile.excludedCompanies = list(dto.excludedCompanies) ?? [];
    if (dto.jobSourceUrls !== undefined)
      profile.jobSourceUrls = list(dto.jobSourceUrls) ?? [];
    return this.profiles.save(profile);
  }

  async allProfileUserIds(): Promise<string[]> {
    const rows = await this.profiles.find({ select: ['userId'] });
    return rows.map((r) => r.userId);
  }

  async latestCompletedScan(userId: string): Promise<CareerScan | null> {
    return this.scans.findOne({
      where: { userId, status: 'COMPLETED' },
      order: { startedAt: 'DESC' },
    });
  }

  /**
   * Full daily scan for one user. Idempotent per (userId, IST date).
   * Returns the scan, or null when the profile is not set up yet.
   */
  async runScanForUser(
    userId: string,
    sendReport: (text: string) => Promise<void>,
  ): Promise<CareerScan | null> {
    const profile = await this.getOrCreateProfile(userId);
    if (
      (profile.targetRoles ?? []).length === 0 &&
      (profile.skills ?? []).length === 0
    ) {
      this.logger.warn(
        `[CareerScheduler] user ${userId} has no career profile yet — skipping scan`,
      );
      return null;
    }
    const scanDate = istDateString();
    const claimed = await this.claimScan(userId, scanDate);
    if (!claimed) return null; // already done / running elsewhere

    try {
      this.logger.log('[CareerScheduler] Job discovery started');
      const maxPerSource =
        this.config.get<number>('career.maxJobsPerSource') ?? 30;
      const { jobs: discovered, failures } = await this.sources.discoverAll({
        keywords: profile.targetRoles ?? [],
        skills: profile.skills ?? [],
        location: profile.location,
        limit: maxPerSource,
        sourceUrls: profile.jobSourceUrls ?? [],
      });
      for (const f of failures) {
        this.logger.warn(`[CareerScheduler] source failure: ${f}`);
      }
      this.logger.log(
        `[CareerScheduler] ${discovered.length} jobs discovered`,
      );

      const { created, duplicatesRemoved } =
        await this.jobs.upsertJobs(discovered);
      void created;
      this.logger.log(
        `[CareerScheduler] ${duplicatesRemoved} duplicate jobs removed`,
      );
      claimed.jobsDiscovered = discovered.length;
      claimed.duplicatesRemoved = duplicatesRemoved;
      await this.scans.save(claimed);

      const maxMatched =
        this.config.get<number>('career.maxMatchedJobsPerDay') ?? 20;
      const matches = await this.jobs.matchForUser(
        userId,
        profile,
        claimed.id,
        maxMatched,
      );
      this.logger.log(`[CareerScheduler] ${matches.length} jobs matched`);
      claimed.jobsMatched = matches.length;
      await this.scans.save(claimed);

      this.logger.log('[CareerScheduler] Networking discovery started');
      const maxNet =
        this.config.get<number>('career.maxNetworkingMatchesPerDay') ?? 10;
      const netMatches = await this.networking.discoverFromMatches(
        userId,
        profile,
        matches,
        claimed.id,
        maxNet,
      );
      claimed.networkingMatches = netMatches.length;
      await this.scans.save(claimed);

      const summary = this.reporter.buildDailySummary(
        claimed,
        matches,
        netMatches,
      );
      claimed.reportText = summary;
      this.logger.log('[CareerScheduler] Daily report generated');
      await this.completeScan(claimed.id, 'COMPLETED', null);
      try {
        await sendReport(summary);
        this.logger.log('[CareerScheduler] Telegram report sent');
      } catch (err) {
        // Results are stored; /careerreport rebuilds the report on demand.
        this.logger.error(
          `[CareerScheduler] Telegram send failed (report stored for retry): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      this.logger.log('[CareerScheduler] Daily career scan completed');
      return (await this.scans.findOne({ where: { id: claimed.id } })) ?? claimed;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.completeScan(claimed.id, 'FAILED', message.slice(0, 2000));
      throw err;
    }
  }

  /** Claim today's scan row. Returns null when already done/running. */
  private async claimScan(
    userId: string,
    scanDate: string,
  ): Promise<CareerScan | null> {
    const existing = await this.scans.findOne({
      where: { userId, scanDate },
    });
    if (existing) {
      if (existing.status === 'COMPLETED') {
        this.logger.log(
          `[CareerScheduler] scan already COMPLETED for user ${userId} on ${scanDate} — skipping`,
        );
        return null;
      }
      const age = Date.now() - new Date(existing.startedAt).getTime();
      if (existing.status === 'RUNNING' && age < STALE_RUNNING_MS) {
        this.logger.log(
          `[CareerScheduler] scan already RUNNING for user ${userId} on ${scanDate} — skipping`,
        );
        return null;
      }
      existing.status = 'RUNNING';
      existing.startedAt = new Date();
      existing.errorMessage = null;
      return this.scans.save(existing);
    }
    try {
      return await this.scans.save(
        this.scans.create({ userId, scanDate, status: 'RUNNING' }),
      );
    } catch {
      // Unique violation: another instance claimed it concurrently.
      this.logger.log(
        `[CareerScheduler] scan claimed concurrently for user ${userId} — skipping`,
      );
      return null;
    }
  }

  private async completeScan(
    scanId: string,
    status: CareerScanStatus,
    errorMessage: string | null,
  ): Promise<void> {
    const scan = await this.scans.findOne({ where: { id: scanId } });
    if (!scan) return;
    scan.status = status;
    scan.completedAt = new Date();
    scan.errorMessage = errorMessage;
    await this.scans.save(scan);
  }
}
