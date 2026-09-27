import { Module, forwardRef } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { PostsModule } from '../posts/posts.module';
import { LinkedInModule } from '../linkedin/linkedin.module';

@Module({
  imports: [forwardRef(() => PostsModule), forwardRef(() => LinkedInModule)],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
