import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinkedInPost } from './entities/linkedin-post.entity';
import { PostEdit } from './entities/post-edit.entity';
import { DailyContentGeneration } from './entities/daily-content-generation.entity';
import { PostAnalytics } from './entities/post-analytics.entity';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { DailyContentService } from './daily-content.service';
import { PostSchedulerService } from './post-scheduler.service';
import { PostQualityService } from './post-quality.service';
import { AiModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';
import { CareerModule } from '../career/career.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LinkedInPost,
      PostEdit,
      DailyContentGeneration,
      PostAnalytics,
    ]),
    AiModule,
    UsersModule,
    forwardRef(() => CareerModule),
  ],
  controllers: [PostsController],
  providers: [
    PostsService,
    DailyContentService,
    PostSchedulerService,
    PostQualityService,
  ],
  exports: [PostsService, DailyContentService, PostSchedulerService],
})
export class PostsModule {}
