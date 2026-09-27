import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PostsService } from '../posts/posts.service';
import { DailyContentService } from '../posts/daily-content.service';
import { LinkedInService } from '../linkedin/linkedin.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly posts: PostsService,
    private readonly linkedin: LinkedInService,
    private readonly daily: DailyContentService,
  ) {}

  @Cron('* * * * *')
  async handleDuePosts() {
    const now = new Date();
    const due = await this.posts.findDuePosts(now, 20);
    for (const post of due) {
      const claimed = await this.posts.claimDuePost(post.id);
      if (!claimed) continue; // already claimed by another instance
      const started = Date.now();
      try {
        const linkedinPostId = await this.linkedin.publishTextPost(
          claimed.userId,
          claimed.content,
        );
        await this.posts.markPublished(claimed.id, linkedinPostId);
        await this.daily.reflectPostStatus(claimed.id);
        this.logger.log(
          `Published post ${claimed.id} user=${claimed.userId} duration=${Date.now() - started}ms`,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        await this.posts.markFailed(claimed.id, message);
        await this.daily.reflectPostStatus(claimed.id);
        this.logger.error(`Failed publishing post ${claimed.id}: ${message}`);
      }
    }
  }

  /** Immediate publish used by Telegram "Publish Now". */
  async publishNow(postId: string, userId: string) {
    const publishing = await this.posts.markPublishing(postId, userId);
    try {
      const linkedinPostId = await this.linkedin.publishTextPost(
        userId,
        publishing.content,
      );
      const done = await this.posts.markPublished(postId, linkedinPostId);
      await this.daily.reflectPostStatus(postId);
      return done;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.posts.markFailed(postId, message);
      await this.daily.reflectPostStatus(postId);
      throw err;
    }
  }
}
