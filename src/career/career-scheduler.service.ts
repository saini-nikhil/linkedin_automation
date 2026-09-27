import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { CareerService } from './career.service';
import { CareerReportService } from './career-report.service';

/**
 * Daily 21:10 Asia/Kolkata career scan. Per-user isolated: one user's
 * failure never breaks another user's scan or crashes the app.
 */
@Injectable()
export class CareerSchedulerService {
  private readonly logger = new Logger(CareerSchedulerService.name);

  constructor(
    private readonly career: CareerService,
    private readonly reporter: CareerReportService,
    private readonly config: ConfigService,
    @InjectBot() private readonly bot: Telegraf<Context>,
  ) {}

  @Cron('10 21 * * *', {
    timeZone: 'Asia/Kolkata',
  })
  async runDailyCareerScan() {
    this.logger.log('[CareerScheduler] Starting daily career scan');
    const telegramId =
      this.config.get<string>('telegram.allowedUserId') ?? '';
    let userIds: string[] = [];
    try {
      userIds = await this.career.allProfileUserIds();
    } catch (err) {
      this.logger.error(
        `[CareerScheduler] cannot load profiles: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }
    for (const userId of userIds) {
      try {
        await this.career.runScanForUser(userId, async (text: string) => {
          if (!telegramId) {
            this.logger.warn(
              '[CareerScheduler] TELEGRAM_ALLOWED_USER_ID not set — report stored, not sent',
            );
            return;
          }
          await this.reporter.sendReport(this.bot, telegramId, text);
        });
      } catch (err) {
        this.logger.error(
          `[CareerScheduler] scan failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    this.logger.log('[CareerScheduler] Daily career scan completed');
  }
}
