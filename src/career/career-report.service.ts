import { Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import { CareerScan } from './entities/career-scan.entity';
import { JobMatch } from '../jobs/entities/job-match.entity';
import { NetworkMatch } from '../networking/entities/network-match.entity';
import { istDisplayDate } from './career.service';

const DIVIDER = '━━━━━━━━━━━━━━━━━━';

/** Builds the ONE concise daily message; bot-agnostic send helper. */
@Injectable()
export class CareerReportService {
  private readonly logger = new Logger(CareerReportService.name);

  buildDailySummary(
    scan: CareerScan,
    matches: JobMatch[],
    netMatches: NetworkMatch[],
  ): string {
    const top = matches.slice(0, 5);
    const lines: string[] = [
      '🌙 DAILY CAREER REPORT',
      DIVIDER,
      `📅 ${istDisplayDate()}`,
      '',
      '💼 JOBS',
      '',
      `${scan.jobsDiscovered} discovered`,
      `${scan.duplicatesRemoved} duplicates removed`,
      `${matches.length} matched`,
      '',
    ];
    if (top.length === 0) {
      lines.push('No strong matches today. Tune /career keywords to widen the net.', '');
    } else {
      lines.push('Top matches:', '');
      top.forEach((m, i) => {
        const job = m.job ?? null;
        const salary =
          job?.salaryMin != null
            ? `   💰 ${job.salaryMin}${job.salaryMax != null ? `–${job.salaryMax}` : ''}${job.currency === 'INR' ? ' LPA' : ` ${job.currency ?? ''}`}`
            : null;
        lines.push(
          `${i + 1}. ${job?.title ?? 'Job'} — ${job?.companyName ?? 'Unknown'}`,
          `   🎯 ${m.matchScore}%`,
          `   📍 ${job?.location ?? 'Unknown'}${job?.workType ? ` / ${job.workType}` : ''}`,
        );
        if (salary) lines.push(salary);
        lines.push('');
      });
    }
    lines.push('🤝 NETWORKING', '', `${netMatches.length} relevant opportunities`, '');
    netMatches.slice(0, 3).forEach((n, i) => {
      lines.push(
        `${i + 1}. ${n.person?.jobTitle ?? 'Professional'} — ${n.person?.company ?? 'Unknown'}`,
      );
    });
    if (netMatches.length > 0) lines.push('');
    lines.push(
      '📌 Nothing was automatically applied or sent.',
      'Use /jobs or /network to review.',
      DIVIDER,
    );
    return lines.join('\n');
  }

  formatJobCard(m: JobMatch, index: number): string {
    const job = m.job ?? null;
    const salary =
      job?.salaryMin != null
        ? `\n💰 ${job.salaryMin}${job.salaryMax != null ? `–${job.salaryMax}` : ''} ${job.currency ?? ''}`.trimEnd()
        : '';
    return [
      `${index}️⃣ ${job?.title ?? 'Job'}`,
      `🏢 ${job?.companyName ?? 'Unknown'}`,
      `📍 ${job?.location ?? 'Unknown'}${job?.workType ? ` / ${job.workType}` : ''}${salary ? `\n${salary}` : ''}`,
      `🎯 Match: ${m.matchScore}%`,
      '',
      'Why:',
      m.explanation ?? 'See job details.',
      '',
      job?.jobUrl ? `🔗 ${job.jobUrl}` : '🔗 No application URL (manual review)',
    ].join('\n');
  }

  formatPersonCard(
    n: NetworkMatch,
    index: number,
    describe: (m: NetworkMatch) => string,
  ): string {
    const person = n.person ?? null;
    return [
      `🤝 ${person?.jobTitle ?? 'Professional'}`,
      `🏢 ${person?.company ?? 'Unknown'}`,
      '',
      'Why relevant:',
      describe(n),
      '',
      person?.profileUrl ? `🔗 ${person.profileUrl}` : '',
    ].join('\n');
  }

  /** Proactive Telegram send. Throws on failure so callers can log + retry later. */
  async sendReport(
    bot: Telegraf<Context>,
    chatId: string,
    text: string,
    extra?: Parameters<Telegraf<Context>['telegram']['sendMessage']>[2],
  ): Promise<void> {
    await bot.telegram.sendMessage(chatId, text, extra);
    this.logger.log('[CareerScheduler] Telegram report sent');
  }
}
