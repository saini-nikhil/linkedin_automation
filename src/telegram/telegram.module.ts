import { Module, forwardRef } from '@nestjs/common';
import { TelegramBot } from './telegram.bot';
import { TelegramService } from './telegram.service';
import { UsersModule } from '../users/users.module';
import { LearningModule } from '../learning/learning.module';
import { PostsModule } from '../posts/posts.module';
import { LinkedInModule } from '../linkedin/linkedin.module';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [
    UsersModule,
    LearningModule,
    forwardRef(() => PostsModule),
    forwardRef(() => LinkedInModule),
    forwardRef(() => SchedulerModule),
  ],
  providers: [TelegramBot, TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
