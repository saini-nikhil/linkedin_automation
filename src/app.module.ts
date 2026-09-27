import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TelegrafModule } from 'nestjs-telegraf';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { DatabaseService } from './database/database.service';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { LearningModule } from './learning/learning.module';
import { PostsModule } from './posts/posts.module';
import { AiModule } from './ai/ai.module';
import { TelegramModule } from './telegram/telegram.module';
import { LinkedInModule } from './linkedin/linkedin.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { JobsModule } from './jobs/jobs.module';
import { ApplicationsModule } from './applications/applications.module';
import { CareerModule } from './career/career.module';
import { ResumeModule } from './resume/resume.module';
import { NetworkingModule } from './networking/networking.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    TelegrafModule.forRootAsync({
      useFactory: () => ({
        token: process.env.TELEGRAM_BOT_TOKEN || 'dummy-token-for-build',
        launchOptions: process.env.TELEGRAM_BOT_TOKEN
          ? undefined
          : false,
      }),
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    LearningModule,
    PostsModule,
    AiModule,
    TelegramModule,
    LinkedInModule,
    SchedulerModule,
    JobsModule,
    ApplicationsModule,
    CareerModule,
    ResumeModule,
    NetworkingModule,
  ],
  providers: [
    DatabaseService,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
