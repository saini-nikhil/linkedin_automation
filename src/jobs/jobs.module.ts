import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from './entities/job.entity';
import { JobMatch } from './entities/job-match.entity';
import { AiModule } from '../ai/ai.module';
import { JobsService } from './jobs.service';
import { JobSourceService } from './job-source.service';
import { JobMatcherService } from './job-matcher.service';
import { JobsController } from './jobs.controller';
import { RemoteOkProvider } from './sources/remoteok.provider';
import { ArbeitnowProvider } from './sources/arbeitnow.provider';
import { HnHiringProvider } from './sources/hn-hiring.provider';
import { ManualProvider } from './sources/manual.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Job, JobMatch]), HttpModule, AiModule],
  controllers: [JobsController],
  providers: [
    JobsService,
    JobSourceService,
    JobMatcherService,
    RemoteOkProvider,
    ArbeitnowProvider,
    HnHiringProvider,
    ManualProvider,
  ],
  exports: [JobsService, JobSourceService, JobMatcherService],
})
export class JobsModule {}
