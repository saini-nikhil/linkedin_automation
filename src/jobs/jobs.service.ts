import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity';
import { JobMatch } from './entities/job-match.entity';
import { DiscoveredJob } from './job-source.provider';
import { CareerProfile } from '../career/entities/career-profile.entity';
import { JobMatcherService } from './job-matcher.service';
import {
  hashJobIdentity,
  normalizeJobUrl,
  toValidDate,
} from './utils/job-normalize.util';

export interface UpsertReport {
  discovered: number;
  created: number;
  duplicatesRemoved: number;
  jobs: Job[];
}

const MIN_MATCH_SCORE = 40;
const RECENT_DAYS = 30;
const AI_EXPLAIN_TOP_N = 5;

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(Job)
    private readonly jobs: Repository<Job>,
    @InjectRepository(JobMatch)
    private readonly matches: Repository<JobMatch>,
    private readonly matcher: JobMatcherService,
  ) {}

  /**
   * Normalize + dedupe discovered jobs.
   * Identity = (source, externalId); falls back to a stable URL hash.
   */
  async upsertJobs(discovered: DiscoveredJob[]): Promise<UpsertReport> {
    const seen = new Set<string>();
    let created = 0;
    let duplicatesRemoved = 0;
    const jobs: Job[] = [];
    for (const raw of discovered) {
      const source = (raw.source ?? 'unknown').slice(0, 64);
      let externalId = (raw.externalId ?? '').trim();
      if (!externalId && raw.jobUrl) {
        externalId = hashJobIdentity(`url:${normalizeJobUrl(raw.jobUrl)}`);
      }
      if (!externalId) {
        duplicatesRemoved += 1;
        continue;
      }
      const key = `${source}::${externalId}`;
      if (seen.has(key)) {
        duplicatesRemoved += 1;
        continue;
      }
      seen.add(key);
      const existing = await this.jobs.findOne({
        where: { source, externalId },
      });
      if (existing) {
        existing.title = raw.title || existing.title;
        existing.companyName = raw.companyName ?? existing.companyName;
        existing.companyUrl = raw.companyUrl ?? existing.companyUrl;
        existing.jobUrl = raw.jobUrl ?? existing.jobUrl;
        existing.description = raw.description ?? existing.description;
        existing.location = raw.location ?? existing.location;
        existing.workType = raw.workType ?? existing.workType;
        existing.employmentType = raw.employmentType ?? existing.employmentType;
        existing.salaryMin = raw.salaryMin ?? existing.salaryMin;
        existing.salaryMax = raw.salaryMax ?? existing.salaryMax;
        existing.currency = raw.currency ?? existing.currency;
        if (raw.skills?.length) existing.skills = raw.skills;
        const validPostedAt = toValidDate(raw.postedAt);
        if (validPostedAt) existing.postedAt = validPostedAt;
        existing.lastSeenAt = new Date();
        existing.isActive = true;
        jobs.push(await this.jobs.save(existing));
        duplicatesRemoved += 1;
        continue;
      }
      const created_job = this.jobs.create({
        source,
        externalId,
        title: (raw.title || 'Untitled role').slice(0, 500),
        companyName: raw.companyName ?? null,
        companyUrl: raw.companyUrl ?? null,
        jobUrl: raw.jobUrl ?? null,
        description: raw.description ?? null,
        location: raw.location ?? null,
        workType: raw.workType ?? null,
        employmentType: raw.employmentType ?? null,
        salaryMin: raw.salaryMin ?? null,
        salaryMax: raw.salaryMax ?? null,
        currency: raw.currency ?? null,
        skills: raw.skills ?? [],
        postedAt: toValidDate(raw.postedAt),
        lastSeenAt: new Date(),
        isActive: true,
      });
      jobs.push(await this.jobs.save(created_job));
      created += 1;
    }
    return {
      discovered: discovered.length,
      created,
      duplicatesRemoved,
      jobs,
    };
  }

  /**
   * Score active recent jobs for a user. Already-matched jobs are skipped
   * unless the job changed since the match (resurfacing rule).
   */
  async matchForUser(
    userId: string,
    profile: CareerProfile,
    scanId: string | null,
    limit: number,
  ): Promise<JobMatch[]> {
    const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
    const candidates = await this.jobs
      .createQueryBuilder('j')
      .where('j.isActive = :active', { active: true })
      .andWhere('j.lastSeenAt >= :since', { since })
      .orderBy('j.lastSeenAt', 'DESC')
      .take(Math.max(limit * 10, 100))
      .getMany();
    const existing = await this.matches.find({ where: { userId } });
    const existingByJob = new Map(existing.map((m) => [m.jobId, m]));

    const scored: { job: Job; breakdown: ReturnType<JobMatcherService['score']> }[] = [];
    for (const job of candidates) {
      if (this.isExcluded(profile, job)) continue;
      const prev = existingByJob.get(job.id);
      if (prev && job.updatedAt.getTime() <= prev.createdAt.getTime()) {
        continue; // already surfaced and unchanged
      }
      const breakdown = this.matcher.score(profile, job);
      if (breakdown.score >= MIN_MATCH_SCORE) scored.push({ job, breakdown });
    }
    scored.sort((a, b) => b.breakdown.score - a.breakdown.score);
    const top = scored.slice(0, limit);

    const saved: JobMatch[] = [];
    for (let i = 0; i < top.length; i++) {
      const { job, breakdown } = top[i];
      const explanation =
        i < AI_EXPLAIN_TOP_N
          ? await this.matcher.explain(breakdown, profile, job)
          : this.matcher.templateExplanation(breakdown, profile, job);
      const prev = existingByJob.get(job.id);
      if (prev) {
        prev.matchScore = breakdown.score;
        prev.matchedSkills = breakdown.matchedSkills;
        prev.missingSkills = breakdown.missingSkills;
        prev.roleMatch = breakdown.roleMatch;
        prev.experienceMatch = breakdown.experienceMatch;
        prev.locationMatch = breakdown.locationMatch;
        prev.workTypeMatch = breakdown.workTypeMatch;
        prev.salaryMatch = breakdown.salaryMatch;
        prev.explanation = explanation;
        prev.scanId = scanId;
        prev.job = job;
        saved.push(await this.matches.save(prev));
      } else {
        const created_match = this.matches.create({
          userId,
          jobId: job.id,
          scanId,
          matchScore: breakdown.score,
          matchedSkills: breakdown.matchedSkills,
          missingSkills: breakdown.missingSkills,
          roleMatch: breakdown.roleMatch,
          experienceMatch: breakdown.experienceMatch,
          locationMatch: breakdown.locationMatch,
          workTypeMatch: breakdown.workTypeMatch,
          salaryMatch: breakdown.salaryMatch,
          explanation,
        });
        created_match.job = job;
        saved.push(await this.matches.save(created_match));
      }
    }
    this.logger.log(`Matched ${saved.length} jobs for user ${userId}`);
    return saved;
  }

  private isExcluded(profile: CareerProfile, job: Job): boolean {
    const excluded = (profile.excludedCompanies ?? []).map((c) =>
      c.trim().toLowerCase(),
    );
    if (excluded.length === 0) return false;
    const company = (job.companyName ?? '').toLowerCase();
    return excluded.some((e) => e && company.includes(e));
  }

  async findMatchesForUser(
    userId: string,
    opts: { scanId?: string; limit?: number } = {},
  ): Promise<JobMatch[]> {
    const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
    const qb = this.matches
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.job', 'job')
      .where('m.userId = :userId', { userId })
      .orderBy('m.matchScore', 'DESC')
      .take(limit);
    if (opts.scanId) qb.andWhere('m.scanId = :scanId', { scanId: opts.scanId });
    return qb.getMany();
  }

  async findJobForUser(jobId: string): Promise<Job> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }
}
