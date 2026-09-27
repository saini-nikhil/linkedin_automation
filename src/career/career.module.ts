import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CareerProfile } from './entities/career-profile.entity';
import { CareerScan } from './entities/career-scan.entity';
import { CareerService } from './career.service';
import { CareerSchedulerService } from './career-scheduler.service';
import { CareerReportService } from './career-report.service';
import { JobsModule } from '../jobs/jobs.module';
import { NetworkingModule } from '../networking/networking.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CareerProfile, CareerScan]),
    JobsModule,
    NetworkingModule,
  ],
  providers: [CareerService, CareerSchedulerService, CareerReportService],
  exports: [CareerService, CareerReportService],
})
export class CareerModule {}
