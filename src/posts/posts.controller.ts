import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostStatus } from '../common/constants/post-status.enum';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { SchedulePostDto } from './dto/schedule-post.dto';
import { RegeneratePostDto } from './dto/regenerate-post.dto';

function requireUserId(header: string | undefined): string {
  if (!header) throw new Error('Missing x-user-id header');
  return header;
}

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  list(
    @Headers('x-user-id') userId: string,
    @Query('status') status?: PostStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const uid = requireUserId(userId);
    return this.posts.findForUser(uid, {
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    return this.posts.findOneForUser(id, requireUserId(userId));
  }

  @Post()
  create(@Body() dto: CreatePostDto, @Headers('x-user-id') userId: string) {
    return this.posts.create(requireUserId(userId), dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @Headers('x-user-id') userId: string,
  ) {
    if (!dto.content) return this.posts.findOneForUser(id, requireUserId(userId));
    return this.posts.edit(id, requireUserId(userId), dto.content);
  }

  @Post(':id/generate')
  generate(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    return this.posts.generate(id, requireUserId(userId));
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    return this.posts.approve(id, requireUserId(userId));
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    return this.posts.reject(id, requireUserId(userId));
  }

  @Post(':id/regenerate')
  regenerate(
    @Param('id') id: string,
    @Body() dto: RegeneratePostDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.posts.regenerate(id, requireUserId(userId), dto?.style);
  }

  @Post(':id/schedule')
  schedule(
    @Param('id') id: string,
    @Body() dto: SchedulePostDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.posts.schedule(id, requireUserId(userId), new Date(dto.scheduledAt));
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    // Publish-now is handled by SchedulerService.publishNow (needs LinkedIn).
    // This endpoint marks PUBLISHING; the scheduler/LinkedIn flow completes it.
    return this.posts.markPublishing(id, requireUserId(userId));
  }
}
