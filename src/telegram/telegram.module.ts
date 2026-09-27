import { Module, forwardRef } from '@nestjs/common';
import { TelegramBot } from './telegram.bot';
import { TelegramService } from './telegram.service';
import { UsersModule } from '../users/users.module';
import { LearningModule } from '../learning/learning.module';
import { PostsModule } from '../posts/posts.module';
import { LinkedInModule } from '../linkedin/linkedin.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { CareerModule } from '../career/career.module';
import { JobsModule } from '../jobs/jobs.module';
import { ApplicationsModule } from '../applications/applications.module';
import { ResumeModule } from '../resume/resume.module';
import { NetworkingModule } from '../networking/networking.module';

@Module({
  imports: [
    UsersModule,
    LearningModule,
    forwardRef(() => PostsModule),
    forwardRef(() => LinkedInModule),
    forwardRef(() => SchedulerModule),
    CareerModule,
    JobsModule,
    ApplicationsModule,
    ResumeModule,
    NetworkingModule,
  ],
  providers: [TelegramBot, TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
