import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinkedInPost } from './entities/linkedin-post.entity';
import { PostEdit } from './entities/post-edit.entity';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([LinkedInPost, PostEdit]), AiModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
