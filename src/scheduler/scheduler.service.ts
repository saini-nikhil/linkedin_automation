import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PostsService } from '../posts/posts.service';
import { LinkedInService } from '../linkedin/linkedin.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly posts: PostsService,
    private readonly linkedin: LinkedInService,
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
        this.logger.log(
          `Published post ${claimed.id} user=${claimed.userId} duration=${Date.now() - started}ms`,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        await this.posts.markFailed(claimed.id, message);
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
      return this.posts.markPublished(postId, linkedinPostId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.posts.markFailed(postId, message);
      throw err;
    }
  }
}
