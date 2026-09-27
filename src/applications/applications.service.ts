import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application, ApplicationStatus } from './entities/application.entity';
import { JobsService } from '../jobs/jobs.service';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @InjectRepository(Application)
    private readonly applications: Repository<Application>,
    private readonly jobs: JobsService,
  ) {}

  /** Save-for-later. Never submits anything anywhere. */
  async save(userId: string, jobId: string): Promise<Application> {
    await this.jobs.findJobForUser(jobId);
    const existing = await this.applications.findOne({
      where: { userId, jobId },
    });
    if (existing) return existing;
    const app = await this.applications.save(
      this.applications.create({ userId, jobId, status: 'SAVED' }),
    );
    this.logger.log(`Job ${jobId} saved for user ${userId}`);
    return app;
  }

  async setStatus(
    userId: string,
    jobId: string,
    status: ApplicationStatus,
  ): Promise<Application> {
    const app = await this.applications.findOne({
      where: { userId, jobId },
    });
    if (!app) throw new NotFoundException('Application not found');
    app.status = status;
    if (status === 'APPLIED') app.appliedAt = new Date();
    return this.applications.save(app);
  }

  /**
   * Records a MANUAL application confirmed by the user in Telegram.
   * The system never claims a submission happened unless the user says so.
   */
  async markApplied(
    userId: string,
    jobId: string,
    applicationUrl?: string,
  ): Promise<Application> {
    const existing = await this.applications.findOne({
      where: { userId, jobId },
    });
    const app =
      existing ??
      this.applications.create({ userId, jobId, status: 'SAVED' });
    app.status = 'APPLIED';
    app.appliedAt = new Date();
    if (applicationUrl) app.applicationUrl = applicationUrl;
    const saved = await this.applications.save(app);
    this.logger.log(`Job ${jobId} marked APPLIED (manual) for user ${userId}`);
    return saved;
  }

  async saveCoverLetter(
    userId: string,
    jobId: string,
    coverLetter: string,
  ): Promise<Application> {
    const existing = await this.applications.findOne({
      where: { userId, jobId },
    });
    const app =
      existing ??
      this.applications.create({ userId, jobId, status: 'SAVED' });
    app.coverLetter = coverLetter;
    return this.applications.save(app);
  }

  async findForUser(userId: string, limit = 20): Promise<Application[]> {
    return this.applications
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.job', 'job')
      .where('a.userId = :userId', { userId })
      .orderBy('a.updatedAt', 'DESC')
      .take(Math.min(50, Math.max(1, limit)))
      .getMany();
  }
}
