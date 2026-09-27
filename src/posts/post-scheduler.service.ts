import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { DailyContentService } from './daily-content.service';
import { UsersService } from '../users/users.service';
import { istDateString } from '../career/career.service';
import { postReviewKeyboard } from '../telegram/telegram.keyboards';

/**
 * 10:00 AM IST daily tech-post draft. DRAFT ONLY — this service never
 * touches the LinkedIn publish API. Publishing happens exclusively via
 * explicit Telegram approval (Publish Now / approved schedule).
 */
@Injectable()
export class PostSchedulerService {
  private readonly logger = new Logger(PostSchedulerService.name);

  constructor(
    private readonly daily: DailyContentService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
    @InjectBot() private readonly bot: Telegraf<Context>,
  ) {}

  @Cron('0 10 * * *', {
    timeZone: 'Asia/Kolkata',
  })
  async generateDailyTechPost() {
    this.logger.log('[DailyContent] Starting 10:00 AM tech-post generation');
    const dateStr = istDateString();
    let userIds: string[] = [];
    try {
      userIds = await this.users.findAllIds();
    } catch (err) {
      this.logger.error(
        `[DailyContent] cannot load users: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }
    for (const userId of userIds) {
      try {
        await this.generateNowForUser(userId, dateStr);
      } catch {
        // Already logged inside generateNowForUser — continue with next user.
      }
    }
    this.logger.log('[DailyContent] 10:00 AM run completed');
  }

  /**
   * On-demand generation for one user (used by the cron loop and the
   * /dailypost Telegram command). Same-day repeats resend today's
   * existing preview — never a duplicate draft. Draft only, no publish.
   */
  async generateNowForUser(userId: string, dateStr = istDateString()) {
    const telegramId = this.config.get<string>('telegram.allowedUserId') ?? '';
    try {
      const result = await this.daily.generateDailyPost(userId, dateStr);
      if (!result) return;
      if (!result.ok) {
        await this.send(
          telegramId,
          '⚠️ I couldn\'t generate a reliable post today.',
        );
        return;
      }
      const { post, daily } = result;
      await this.send(
        telegramId,
        [
          '☀️ GOOD MORNING — TODAY\'S TECH POST',
          '',
          'I prepared a post for your LinkedIn.',
          '',
          `📌 Topic:\n${daily.topic ?? 'Tech'}`,
          '',
          `🎯 Type:\n${daily.category ?? 'CONCEPT_EXPLAINED'}`,
          '',
          post.content,
          '',
          'What do you want to do?',
        ].join('\n'),
        postReviewKeyboard(post.id),
      );
      this.logger.log(`[DailyContent] preview sent for post ${post.id}`);
    } catch (err) {
      this.logger.error(
        `[DailyContent] generation failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  private async send(
    telegramId: string,
    text: string,
    extra?: Parameters<Telegraf<Context>['telegram']['sendMessage']>[2],
  ) {
    if (!telegramId) {
      this.logger.warn('[DailyContent] TELEGRAM_ALLOWED_USER_ID not set — preview skipped');
      return;
    }
    await this.bot.telegram.sendMessage(telegramId, text, extra);
  }
}
