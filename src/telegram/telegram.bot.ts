import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Action,
  Command,
  Ctx,
  Help,
  On,
  Start,
  Update,
} from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { UsersService } from '../users/users.service';
import { LearningService } from '../learning/learning.service';
import { PostsService } from '../posts/posts.service';
import { DailyContentService } from '../posts/daily-content.service';
import { PostSchedulerService } from '../posts/post-scheduler.service';
import { LinkedInService } from '../linkedin/linkedin.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { TelegramService } from './telegram.service';
import { TelegramSessionMode } from './telegram.states';
import {
  approvedKeyboard,
  careerProfileKeyboard,
  collectingKeyboard,
  coverReviewKeyboard,
  jobApplyKeyboard,
  jobCardKeyboard,
  learningSavedKeyboard,
  messageApprovedKeyboard,
  messageReviewKeyboard,
  networkCardKeyboard,
  pagerRows,
  postReviewKeyboard,
  rejectReasonKeyboard,
  scheduleKeyboard,
} from './telegram.keyboards';
import { PostStatus } from '../common/constants/post-status.enum';
import { PostStyle } from '../common/constants/post-style.enum';
import { CareerService, istDisplayDate } from '../career/career.service';
import { CareerReportService } from '../career/career-report.service';
import { JobsService } from '../jobs/jobs.service';
import { JobMatch } from '../jobs/entities/job-match.entity';
import { ApplicationsService } from '../applications/applications.service';
import { ResumeService } from '../resume/resume.service';
import { NetworkingService } from '../networking/networking.service';
import { NetworkingMatcherService } from '../networking/networking-matcher.service';
import { NetworkingMessageService } from '../networking/networking-message.service';
import { NetworkMatch } from '../networking/entities/network-match.entity';

const CAREER_PAGE_SIZE = 5;

@Update()
@Injectable()
export class TelegramBot {
  private readonly logger = new Logger(TelegramBot.name);
  private readonly allowedUserId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly learning: LearningService,
    private readonly posts: PostsService,
    private readonly daily: DailyContentService,
    private readonly postScheduler: PostSchedulerService,
    private readonly linkedin: LinkedInService,
    private readonly scheduler: SchedulerService,
    private readonly tg: TelegramService,
    private readonly career: CareerService,
    private readonly careerReport: CareerReportService,
    private readonly jobs: JobsService,
    private readonly applications: ApplicationsService,
    private readonly resume: ResumeService,
    private readonly networking: NetworkingService,
    private readonly netMatcher: NetworkingMatcherService,
    private readonly netMessages: NetworkingMessageService,
  ) {
    this.allowedUserId =
      this.config.get<string>('telegram.allowedUserId') ?? '';
  }

  private isAuthorized(ctx: Context): boolean {
    const fromId = String(ctx.from?.id ?? '');
    if (!this.allowedUserId) return true; // no restriction configured (dev)
    return fromId === String(this.allowedUserId);
  }

  private async ensureUser(ctx: Context) {
    const telegramId = String(ctx.from!.id);
    const username = ctx.from?.username;
    return this.users.ensureFromTelegram(telegramId, username);
  }

  private async guard(ctx: Context): Promise<null | { userId: string; telegramId: string }> {
    if (!this.isAuthorized(ctx)) {
      await ctx.reply('⛔ Unauthorized.');
      return null;
    }
    const user = await this.ensureUser(ctx);
    return { userId: user.id, telegramId: String(ctx.from!.id) };
  }

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.reply(
      '👋 Welcome! I am your LinkedIn + Career assistant.\n\n' +
        '📚 LEARN → POST\n' +
        '/learn - record what you learned, get an AI LinkedIn post\n' +
        '/posts - your recent posts\n' +
        '/linkedin - connect your LinkedIn account\n\n' +
        '☀️ DAILY TECH POST (10:00 AM IST draft, you approve)\n' +
        'A fresh tech draft arrives every morning — approve, edit,\n' +
        'regenerate, schedule, or reject it right from Telegram.\n' +
        '/dailypost - generate today\'s tech post right now\n\n' +
        '💼 CAREER (daily report at 9:10 PM IST)\n' +
        '/career - view/update your career profile (required first!)\n' +
        '/jobs - latest matched jobs\n' +
        '/savedjobs - jobs you saved\n' +
        '/applications - application tracker\n' +
        '/network - networking opportunities\n' +
        '/careerreport - latest daily report\n' +
        '/scancareer - run a career scan right now\n\n' +
        '/help - show all commands\n' +
        '/cancel - cancel the current step',
    );
  }

  @Help()
  @Command('help')
  async onHelp(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.reply(
      '/learn - record what you learned\n/posts - recent posts\n/linkedin - connect LinkedIn\n/dailypost - tech post now\n/career - career profile\n/jobs - latest matched jobs\n/savedjobs - saved jobs\n/applications - application tracker\n/network - networking opportunities\n/careerreport - latest daily report\n/cancel - cancel current flow\n/help - this help',
    );
  }

  @Command('cancel')
  async onCancel(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    this.tg.reset(g.telegramId);
    await ctx.reply('Cancelled ✅');
  }

  @Command('learn')
  async onLearn(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    const s = this.tg.getSession(g.telegramId);
    s.mode = TelegramSessionMode.COLLECTING_LEARNING;
    s.buffer = [];
    await ctx.reply(
      '📚 What did you learn today?\n\nSend one or multiple messages. Press 🤖 Generate Post when done.',
      collectingKeyboard(),
    );
  }

  @Command('posts')
  async onPosts(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    const { items } = await this.posts.findForUser(g.userId, { limit: 10 });
    if (items.length === 0) {
      await ctx.reply('No posts yet. Use /learn to create one.');
      return;
    }
    const icon = (s: PostStatus) =>
      s === PostStatus.PUBLISHED
        ? '✅ Published'
        : s === PostStatus.SCHEDULED
          ? '⏳ Scheduled'
          : s === PostStatus.REJECTED
            ? '❌ Rejected'
            : s === PostStatus.FAILED
              ? '⚠️ Failed'
              : '📝 Draft';
    const buttons = items.slice(0, 10).map((p) => [
      Markup.button.callback(
        `${icon(p.status)} · ${p.content.slice(0, 32).replace(/\s+/g, ' ')}`,
        `open:${p.id}`,
      ),
    ]);
    await ctx.reply('Your recent posts:', Markup.inlineKeyboard(buttons));
  }

  @Command('linkedin')
  async onLinkedin(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    try {
      const url = await this.linkedin.getConnectUrl(g.userId);
      await ctx.reply(`🔗 Connect your LinkedIn account:\n${url}`);
    } catch (err) {
      await ctx.reply('Failed to create LinkedIn connect URL. Try again later.');
    }
  }

  // ---------- career commands ----------

  private formatCareerProfile(p: {
    targetRoles: string[];
    skills: string[];
    experienceYears: number | null;
    location: string | null;
    workTypes: string[];
    salaryMin: number | null;
    salaryMax: number | null;
    currency: string;
    noticePeriodDays: number | null;
    employmentTypes: string[];
    targetCompanies: string[];
    excludedCompanies: string[];
  }): string {
    const salary =
      p.salaryMin != null
        ? `${p.salaryMin}${p.salaryMax != null ? `–${p.salaryMax}` : '+'} ${p.currency}`
        : 'Not set';
    return [
      '👤 Career Profile',
      '',
      'Target roles:',
      ...((p.targetRoles ?? []).length > 0 ? p.targetRoles : ['(not set)']),
      '',
      'Skills:',
      ...((p.skills ?? []).length > 0 ? p.skills : ['(not set)']),
      '',
      `Experience: ${p.experienceYears != null ? `${p.experienceYears} years` : 'Not set'}`,
      `Location: ${p.location ?? 'Not set'}`,
      `Work type: ${(p.workTypes ?? []).join(' / ') || 'Not set'}`,
      `Minimum salary: ${salary}`,
      `Notice period: ${p.noticePeriodDays != null ? `${p.noticePeriodDays} days` : 'Not set'}`,
      `Employment type: ${(p.employmentTypes ?? []).join(', ') || 'Not set'}`,
      `Target companies: ${(p.targetCompanies ?? []).join(', ') || '—'}`,
      `Excluded companies: ${(p.excludedCompanies ?? []).join(', ') || '—'}`,
    ].join('\n');
  }

  @Command('career')
  async onCareer(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    const profile = await this.career.getOrCreateProfile(g.userId);
    await ctx.reply(
      this.formatCareerProfile(profile),
      careerProfileKeyboard(),
    );
  }

  @Command('profile')
  async onProfile(@Ctx() ctx: Context) {
    return this.onCareer(ctx);
  }

  @Command('jobs')
  async onJobs(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    await this.sendJobsPage(ctx, g.userId, 0);
  }

  @Command('savedjobs')
  async onSavedJobs(@Ctx() ctx: Context) {
    return this.onApplications(ctx);
  }

  @Command('applications')
  async onApplications(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    await this.sendApplicationsPage(ctx, g.userId, 0);
  }

  @Command('network')
  async onNetwork(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    await this.sendNetworkPage(ctx, g.userId, 0);
  }

  @Command('careerreport')
  async onCareerReport(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    const scan = await this.career.latestCompletedScan(g.userId);
    if (!scan) {
      await ctx.reply(
        'No daily report yet. Reports run at 9:10 PM IST, or trigger one now with /scancareer (requires /career profile first).',
      );
      return;
    }
    if (scan.reportText) {
      await ctx.reply(scan.reportText);
      return;
    }
    const matches = await this.jobs.findMatchesForUser(g.userId, {
      scanId: scan.id,
      limit: 50,
    });
    const net = await this.networking.findMatchesForUser(g.userId, {
      scanId: scan.id,
      limit: 50,
    });
    await ctx.reply(this.careerReport.buildDailySummary(scan, matches, net));
  }

  @Command('scancareer')
  async onScanCareer(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.reply('🔎 Starting career scan…');
    try {
      const scan = await this.career.runScanForUser(g.userId, async () => undefined);
      if (!scan) {
        await ctx.reply('Set up your profile first with /career.');
        return;
      }
      await ctx.reply(
        scan.reportText ??
          `Scan ${scan.status}: ${scan.jobsDiscovered} discovered, ${scan.jobsMatched} matched.`,
      );
    } catch (err) {
      await ctx.reply(
        `Scan failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  @Command('dailypost')
  async onDailyPost(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.reply('🔎 Generating your tech post…');
    try {
      await this.postScheduler.generateNowForUser(g.userId);
    } catch (err) {
      await ctx.reply(
        `Generation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async handleCareerInput(
    ctx: Context,
    userId: string,
    telegramId: string,
    session: { mode: TelegramSessionMode; buffer: string[] },
    message: string,
  ) {
    const s = this.tg.getSession(telegramId);
    const list = (raw: string) =>
      [...new Set(raw.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean))].slice(0, 50);
    try {
      switch (session.mode) {
        case TelegramSessionMode.AWAITING_CAREER_ROLES:
          await this.career.updateProfile(userId, { targetRoles: list(message) });
          break;
        case TelegramSessionMode.AWAITING_CAREER_SKILLS:
          await this.career.updateProfile(userId, { skills: list(message) });
          break;
        case TelegramSessionMode.AWAITING_CAREER_LOCATION:
          await this.career.updateProfile(userId, { location: message });
          break;
        case TelegramSessionMode.AWAITING_CAREER_SALARY: {
          const nums = (message.match(/\d+(\.\d+)?/g) ?? []).map((n) =>
            Math.round(parseFloat(n)),
          );
          await this.career.updateProfile(userId, {
            salaryMin: nums[0] ?? null,
            salaryMax: nums[1] ?? null,
          });
          break;
        }
        case TelegramSessionMode.AWAITING_CAREER_WORKTYPE:
          await this.career.updateProfile(userId, {
            workTypes: list(message.replace(/[\/;]/g, ',')),
          });
          break;
        case TelegramSessionMode.AWAITING_CAREER_EXPERIENCE: {
          const years = parseFloat(message.replace(/[^\d.]/g, ''));
          await this.career.updateProfile(userId, {
            experienceYears: Number.isFinite(years) ? Math.round(years) : null,
          });
          break;
        }
        case TelegramSessionMode.AWAITING_CAREER_URLS: {
          const urls = message
            .split(/\s+/)
            .map((u) => u.trim())
            .filter((u) => u.startsWith('http'));
          await this.career.updateProfile(userId, { jobSourceUrls: urls });
          break;
        }
        default:
          break;
      }
      s.mode = TelegramSessionMode.IDLE;
      const profile = await this.career.getOrCreateProfile(userId);
      await ctx.reply(
        `💾 Saved.\n\n${this.formatCareerProfile(profile)}`,
        careerProfileKeyboard(),
      );
    } catch {
      await ctx.reply('Could not save. Try again.');
    }
  }

  private async sendJobsPage(ctx: Context, userId: string, page: number, edit = false) {
    const all = await this.jobs.findMatchesForUser(userId, { limit: 50 });
    if (all.length === 0) {
      const text = 'No matched jobs yet. Reports run at 9:10 PM IST, or run /scancareer.';
      if (edit) await ctx.editMessageText(text).catch(() => undefined);
      else await ctx.reply(text);
      return;
    }
    const totalPages = Math.max(1, Math.ceil(all.length / CAREER_PAGE_SIZE));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const slice = all.slice(
      safePage * CAREER_PAGE_SIZE,
      safePage * CAREER_PAGE_SIZE + CAREER_PAGE_SIZE,
    );
    const lines = [`💼 Matched jobs (page ${safePage + 1}/${totalPages}):`, ''];
    slice.forEach((m, i) => {
      lines.push(
        `${i + 1}. ${m.job.title} — ${m.job.companyName ?? 'Unknown'} 🎯${m.matchScore}%`,
      );
    });
    lines.push('', 'Tap a job number to open it:');
    const buttons: ReturnType<typeof Markup.button.callback>[][] = slice.map((m, i) => [
      Markup.button.callback(
        `${i + 1}. ${m.job.title.slice(0, 28)}`,
        `job:card:${m.job.id}`,
      ),
    ]);
    buttons.push(...pagerRows('jobs:page', safePage, totalPages));
    const keyboard = Markup.inlineKeyboard(buttons);
    const text = lines.join('\n');
    if (edit) {
      await ctx.editMessageText(text, keyboard).catch(() => undefined);
    } else {
      await ctx.reply(text, keyboard);
    }
  }

  private async sendApplicationsPage(ctx: Context, userId: string, page: number, edit = false) {
    const all = await this.applications.findForUser(userId, 50);
    if (all.length === 0) {
      const text = 'Nothing saved yet. Open /jobs and tap 📌 Save on a match.';
      if (edit) await ctx.editMessageText(text).catch(() => undefined);
      else await ctx.reply(text);
      return;
    }
    const totalPages = Math.max(1, Math.ceil(all.length / CAREER_PAGE_SIZE));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const slice = all.slice(
      safePage * CAREER_PAGE_SIZE,
      safePage * CAREER_PAGE_SIZE + CAREER_PAGE_SIZE,
    );
    const lines = [`📌 Applications (page ${safePage + 1}/${totalPages}):`, ''];
    slice.forEach((a, i) => {
      lines.push(`${i + 1}. ${a.job.title} — ${a.job.companyName ?? '?'} [${a.status}]`);
    });
    const text = lines.join('\n');
    const keyboard = pagerRows('apps:page', safePage, totalPages);
    if (edit) {
      await ctx.editMessageText(text, Markup.inlineKeyboard(keyboard)).catch(() => undefined);
    } else {
      await ctx.reply(text, Markup.inlineKeyboard(keyboard));
    }
  }

  private async sendNetworkPage(ctx: Context, userId: string, page: number, edit = false) {
    const all = await this.networking.findMatchesForUser(userId, { limit: 50 });
    if (all.length === 0) {
      const text = 'No networking opportunities yet. They appear after the 9:10 PM scan.';
      if (edit) await ctx.editMessageText(text).catch(() => undefined);
      else await ctx.reply(text);
      return;
    }
    const totalPages = Math.max(1, Math.ceil(all.length / CAREER_PAGE_SIZE));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const slice = all.slice(
      safePage * CAREER_PAGE_SIZE,
      safePage * CAREER_PAGE_SIZE + CAREER_PAGE_SIZE,
    );
    const lines = [`🤝 Networking (page ${safePage + 1}/${totalPages}):`, ''];
    slice.forEach((n, i) => {
      lines.push(
        `${i + 1}. ${n.person.jobTitle ?? 'Professional'} — ${n.person.company ?? '?'} (${n.matchScore}%)`,
      );
    });
    lines.push('', 'Tap to open:');
    const buttons: ReturnType<typeof Markup.button.callback>[][] = slice.map((n, i) => [
      Markup.button.callback(
        `${i + 1}. ${(n.person.company ?? 'Unknown').slice(0, 28)}`,
        `net:card:${n.person.id}`,
      ),
    ]);
    buttons.push(...pagerRows('net:page', safePage, totalPages));
    const keyboard = Markup.inlineKeyboard(buttons);
    const text = lines.join('\n');
    if (edit) {
      await ctx.editMessageText(text, keyboard).catch(() => undefined);
    } else {
      await ctx.reply(text, keyboard);
    }
  }

  @On('text')
  async onText(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    const message = (ctx.message as { text?: string })?.text?.trim() ?? '';
    if (!message) return;
    if (message.startsWith('/')) return; // commands handled elsewhere

    const session = this.tg.getSession(g.telegramId);

    if (session.mode === TelegramSessionMode.AWAITING_EDIT && session.pendingPostId) {
      try {
        const updated = await this.posts.edit(g.userId, session.pendingPostId, message);
        session.mode = TelegramSessionMode.IDLE;
        await ctx.reply(
          `✏️ Updated:\n\n${updated.content}`,
          postReviewKeyboard(updated.id),
        );
      } catch {
        await ctx.reply('Could not update the post. It may not belong to you.');
      }
      return;
    }

    if (session.mode === TelegramSessionMode.AWAITING_CUSTOM_SCHEDULE && session.pendingPostId) {
      const parsed = this.tg.parseCustomSchedule(message);
      if (!parsed) {
        await ctx.reply('Invalid format. Use YYYY-MM-DD HH:mm (e.g. 2026-09-26 10:00).');
        return;
      }
      if (parsed.getTime() <= Date.now()) {
        await ctx.reply('Cannot schedule in the past. Send a future time.');
        return;
      }
      try {
        await this.posts.schedule(g.userId, session.pendingPostId, parsed);
        session.mode = TelegramSessionMode.IDLE;
        await ctx.reply(`🕐 Scheduled!\n${this.tg.formatIST(parsed)} IST`);
      } catch (err) {
        await ctx.reply(err instanceof Error ? err.message : 'Scheduling failed.');
      }
      return;
    }

    if (session.mode.startsWith('AWAITING_CAREER_')) {
      await this.handleCareerInput(ctx, g.userId, g.telegramId, session, message);
      return;
    }

    if (session.mode === TelegramSessionMode.AWAITING_MESSAGE_EDIT && session.pendingMessageId) {
      try {
        const updated = await this.netMessages.updateDraftText(
          g.userId,
          session.pendingMessageId,
          message,
        );
        session.mode = TelegramSessionMode.IDLE;
        await ctx.reply(
          `💬 Updated draft:\n\n${updated.message}`,
          messageReviewKeyboard(updated.id),
        );
      } catch {
        await ctx.reply('Could not update the draft.');
      }
      return;
    }

    if (session.mode === TelegramSessionMode.AWAITING_COVER_EDIT && session.pendingJobId) {
      session.pendingCoverText = message.slice(0, 3000);
      session.mode = TelegramSessionMode.IDLE;
      await ctx.reply(
        `✉️ Updated cover letter:\n\n${session.pendingCoverText}`,
        coverReviewKeyboard(session.pendingJobId),
      );
      return;
    }

    if (session.mode === TelegramSessionMode.COLLECTING_LEARNING) {
      session.buffer.push(message);
      await ctx.reply('Noted. Anything else? (🤖 Generate Post when done)', collectingKeyboard());
      return;
    }

    // Default: treat free text as a quick learning note.
    session.mode = TelegramSessionMode.COLLECTING_LEARNING;
    session.buffer = [message];
    await ctx.reply('Saved ✅\n\nChoose:', learningSavedKeyboard());
  }

  // ---------- callback actions ----------

  @Action(/^generate:(.*)$/)
  async onGenerate(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    const session = this.tg.getSession(g.telegramId);
    const combined = session.buffer.join('\n').trim();
    if (!combined) {
      await ctx.answerCbQuery('Send what you learned first.');
      return;
    }
    await ctx.answerCbQuery('Generating…');
    try {
      const note = await this.learning.create(g.userId, { content: combined });
      const post = await this.posts.generateFromLearningNote(
        g.userId,
        note.id,
        note.content,
        PostStyle.SOMETHING_I_LEARNED,
      );
      session.buffer = [];
      session.mode = TelegramSessionMode.IDLE;
      session.pendingPostId = post.id;
      await ctx.reply(`🤖 LinkedIn Post Ready\n\n${post.content}`, postReviewKeyboard(post.id));
    } catch {
      await ctx.reply('AI generation failed. Check OPENROUTER_API_KEY and try again.');
    }
  }

  @Action('addmore')
  async onAddMore(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    const session = this.tg.getSession(g.telegramId);
    session.mode = TelegramSessionMode.COLLECTING_LEARNING;
    await ctx.answerCbQuery();
    await ctx.reply('Send more — I will append it to the same note.');
  }

  @Action('cancel')
  async onCancelAction(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    this.tg.reset(g.telegramId);
    await ctx.answerCbQuery('Cancelled');
    await ctx.reply('Cancelled ✅');
  }

  @Action(/^approve:(.+)$/)
  async onApprove(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    const postId = ctx.match[1];
    try {
      await this.posts.approve(postId, g.userId);
      await this.daily.reflectPostStatus(postId);
      await ctx.answerCbQuery('Approved');
      await ctx.reply('✅ Post approved!', approvedKeyboard(postId));
    } catch (err) {
      await ctx.answerCbQuery('Cannot approve');
      await ctx.reply(err instanceof Error ? err.message : 'Approve failed.');
    }
  }

  @Action(/^reject:(.+)$/)
  async onReject(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    // Daily tech posts: capture an optional reason (improves topic selection).
    const daily = await this.daily.findByPost(ctx.match[1]);
    if (daily) {
      await ctx.answerCbQuery();
      await ctx.reply(
        '❌ Post rejected. Why? (optional, helps future topics)',
        rejectReasonKeyboard(ctx.match[1]),
      );
      return;
    }
    await this.posts.reject(ctx.match[1], g.userId);
    await ctx.answerCbQuery('Rejected');
    await ctx.reply('❌ Post rejected.\nThe post will not be published.');
  }

  @Action(/^reject_reason:([^:]+):(.+)$/)
  async onRejectReason(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    const [, postId, reason] = ctx.match;
    try {
      await this.posts.reject(postId, g.userId);
      if (reason !== 'Skip') {
        await this.posts.setRejectionReason(postId, g.userId, reason);
      }
      await this.daily.reflectPostStatus(postId);
      await ctx.answerCbQuery('Rejected');
      await ctx.reply('❌ Post rejected.\nThe post will not be published.');
    } catch {
      await ctx.answerCbQuery('Reject failed');
    }
  }

  @Action(/^regen:(.+)$/)
  async onRegen(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    // Daily drafts: enforce MAX_REGENERATIONS and regenerate with new angle.
    const gate = await this.daily.noteRegeneration(g.userId, ctx.match[1]);
    if (!gate.allowed) {
      await ctx.answerCbQuery('Limit reached');
      await ctx.reply(
        '🔄 Regeneration limit reached for this draft. Approve, edit, or reject this version.',
      );
      return;
    }
    const daily = await this.daily.findByPost(ctx.match[1]);
    await ctx.answerCbQuery('Regenerating…');
    try {
      const post = daily
        ? await this.daily.regenerateDailyPost(g.userId, ctx.match[1])
        : await this.posts.regenerate(ctx.match[1], g.userId);
      await ctx.reply(`🤖 LinkedIn Post Ready\n\n${post.content}`, postReviewKeyboard(post.id));
    } catch {
      await ctx.reply('Regeneration failed. Try again later.');
    }
  }

  @Action(/^edit:(.+)$/)
  async onEdit(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    const session = this.tg.getSession(g.telegramId);
    session.mode = TelegramSessionMode.AWAITING_EDIT;
    session.pendingPostId = ctx.match[1];
    await ctx.answerCbQuery();
    await ctx.reply('✏️ Send the complete updated post.');
  }

  @Action(/^publish:(.+)$/)
  async onPublish(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery('Publishing…');
    try {
      await this.scheduler.publishNow(ctx.match[1], g.userId);
      await ctx.reply('🚀 Published successfully!');
    } catch (err) {
      await ctx.reply(`Publish failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  @Action(/^schedule:(.+)$/)
  async onSchedule(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery();
    await ctx.reply('Choose a time:', scheduleKeyboard(ctx.match[1]));
  }

  @Action(/^sched_today18:(.+)$/)
  async onSchedToday18(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    try {
      const when = this.tg.todayAt(18, 0);
      await this.posts.schedule(g.userId, ctx.match[1], when);
      await ctx.answerCbQuery('Scheduled');
      await ctx.reply(`🕐 Scheduled!\n${this.tg.formatIST(when)} IST`);
    } catch (err) {
      await ctx.answerCbQuery('Cannot schedule');
      await ctx.reply(err instanceof Error ? err.message : 'Scheduling failed.');
    }
  }

  @Action(/^sched_today20:(.+)$/)
  async onSchedToday20(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    try {
      const when = this.tg.todayAt(20, 0);
      await this.posts.schedule(g.userId, ctx.match[1], when);
      await ctx.answerCbQuery('Scheduled');
      await ctx.reply(`🕐 Scheduled!\n${this.tg.formatIST(when)} IST`);
    } catch (err) {
      await ctx.answerCbQuery('Cannot schedule');
      await ctx.reply(err instanceof Error ? err.message : 'Scheduling failed.');
    }
  }

  @Action(/^sched_am:(.+)$/)
  async onSchedAm(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    const when = this.tg.tomorrowAt(10, 0);
    await this.posts.schedule(g.userId, ctx.match[1], when);
    await ctx.answerCbQuery('Scheduled');
    await ctx.reply(`🕐 Scheduled!\n${this.tg.formatIST(when)} IST`);
  }

  @Action(/^sched_pm:(.+)$/)
  async onSchedPm(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    const when = this.tg.tomorrowAt(19, 0);
    await this.posts.schedule(g.userId, ctx.match[1], when);
    await ctx.answerCbQuery('Scheduled');
    await ctx.reply(`🕐 Scheduled!\n${this.tg.formatIST(when)} IST`);
  }

  @Action(/^sched_custom:(.+)$/)
  async onSchedCustom(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    const session = this.tg.getSession(g.telegramId);
    session.mode = TelegramSessionMode.AWAITING_CUSTOM_SCHEDULE;
    session.pendingPostId = ctx.match[1];
    await ctx.answerCbQuery();
    await ctx.reply('Send custom time as YYYY-MM-DD HH:mm (Asia/Kolkata).');
  }

  @Action(/^open:(.+)$/)
  async onOpen(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    try {
      const post = await this.posts.findOneForUser(ctx.match[1], g.userId);
      await ctx.answerCbQuery();
      await ctx.reply(
        `${post.status}\n\n${post.content}`,
        postReviewKeyboard(post.id),
      );
    } catch {
      await ctx.answerCbQuery('Not found');
    }
  }

  // ---------- career callback actions ----------

  @Action(/^cedit:(roles|skills|location|salary|worktype|exp|urls)$/)
  async onCareerEdit(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    const session = this.tg.getSession(g.telegramId);
    const prompts: Record<string, { mode: TelegramSessionMode; text: string }> = {
      roles: { mode: TelegramSessionMode.AWAITING_CAREER_ROLES, text: 'Send target roles, comma-separated.\nExample: Backend Developer, Node.js Developer' },
      skills: { mode: TelegramSessionMode.AWAITING_CAREER_SKILLS, text: 'Send skills, comma-separated.\nExample: NestJS, TypeScript, PostgreSQL' },
      location: { mode: TelegramSessionMode.AWAITING_CAREER_LOCATION, text: 'Send preferred location.\nExample: India / Remote' },
      salary: { mode: TelegramSessionMode.AWAITING_CAREER_SALARY, text: 'Send salary range as numbers (LPA).\nExample: 8-12' },
      worktype: { mode: TelegramSessionMode.AWAITING_CAREER_WORKTYPE, text: 'Send work type.\nExample: Remote / Hybrid' },
      exp: { mode: TelegramSessionMode.AWAITING_CAREER_EXPERIENCE, text: 'Send experience in years.\nExample: 2' },
      urls: { mode: TelegramSessionMode.AWAITING_CAREER_URLS, text: 'Send career-page URLs separated by spaces (manual review only).' },
    };
    const p = prompts[ctx.match[1]];
    session.mode = p.mode;
    await ctx.answerCbQuery();
    await ctx.reply(`✏️ ${p.text}`);
  }

  @Action(/^jobs:page:(\d+)$/)
  async onJobsPage(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery();
    await this.sendJobsPage(ctx, g.userId, parseInt(ctx.match[1], 10), true);
  }

  @Action(/^apps:page:(\d+)$/)
  async onAppsPage(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery();
    await this.sendApplicationsPage(ctx, g.userId, parseInt(ctx.match[1], 10), true);
  }

  @Action(/^net:page:(\d+)$/)
  async onNetPage(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery();
    await this.sendNetworkPage(ctx, g.userId, parseInt(ctx.match[1], 10), true);
  }

  private async findMatchForUser(userId: string, jobId: string): Promise<JobMatch | null> {
    const all = await this.jobs.findMatchesForUser(userId, { limit: 50 });
    return all.find((m) => m.jobId === jobId || m.job.id === jobId) ?? null;
  }

  @Action(/^job:card:(.+)$/)
  async onJobCard(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery();
    try {
      const job = await this.jobs.findJobForUser(ctx.match[1]);
      const match = await this.findMatchForUser(g.userId, job.id);
      const text = match
        ? this.careerReport.formatJobCard(match, 1)
        : `${job.title}\n🏢 ${job.companyName ?? 'Unknown'}\n📍 ${job.location ?? 'Unknown'}`;
      await ctx.reply(text, jobCardKeyboard(job.id, job.jobUrl));
    } catch {
      await ctx.reply('Job not found.');
    }
  }

  @Action(/^job:save:(.+)$/)
  async onJobSave(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    try {
      await this.applications.save(g.userId, ctx.match[1]);
      await ctx.answerCbQuery('Saved');
      await ctx.reply('📌 Saved. See /savedjobs.');
    } catch {
      await ctx.answerCbQuery('Save failed');
    }
  }

  @Action(/^job:apply:(.+)$/)
  async onJobApply(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery();
    // NEVER auto-submits: shows details + official URL, user applies manually.
    try {
      const job = await this.jobs.findJobForUser(ctx.match[1]);
      const match = await this.findMatchForUser(g.userId, job.id);
      const lines = [
        '🚀 APPLICATION',
        '',
        job.title,
        job.companyName ?? 'Unknown company',
        match ? `\nMatch: ${match.matchScore}%` : '',
        '',
        'Official application: open the link below and apply yourself.',
        'Nothing has been submitted automatically.',
      ].join('\n');
      await ctx.reply(lines, jobApplyKeyboard(job.id, job.jobUrl));
    } catch {
      await ctx.reply('Job not found.');
    }
  }

  @Action(/^job:done:(.+)$/)
  async onJobDone(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    try {
      const job = await this.jobs.findJobForUser(ctx.match[1]);
      await this.applications.markApplied(g.userId, job.id, job.jobUrl ?? undefined);
      await ctx.answerCbQuery('Marked applied');
      await ctx.reply(`✅ Marked as applied (manual): ${job.title}`);
    } catch {
      await ctx.answerCbQuery('Failed');
    }
  }

  @Action(/^job:cancel:(.+)$/)
  async onJobCancel(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery('Cancelled');
    await ctx.reply('❌ Application cancelled. Nothing was submitted.');
  }

  @Action(/^job:resume:(.+)$/)
  async onJobResume(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery('Generating…');
    try {
      const profile = await this.career.getOrCreateProfile(g.userId);
      const job = await this.jobs.findJobForUser(ctx.match[1]);
      const suggestions = await this.resume.suggestResume(profile, job);
      await ctx.reply(`📄 RESUME SUGGESTIONS\n\n${suggestions}`);
    } catch (err) {
      await ctx.reply(err instanceof Error ? err.message : 'Resume help failed.');
    }
  }

  @Action(/^job:cover:(.+)$/)
  async onJobCover(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery('Generating…');
    try {
      const profile = await this.career.getOrCreateProfile(g.userId);
      const job = await this.jobs.findJobForUser(ctx.match[1]);
      const letter = await this.resume.generateCoverLetter(
        profile,
        job,
        ctx.from?.username,
      );
      const session = this.tg.getSession(g.telegramId);
      session.pendingJobId = job.id;
      session.pendingCoverText = letter;
      await ctx.reply(`✉️ COVER LETTER\n\n${letter}`, coverReviewKeyboard(job.id));
    } catch (err) {
      await ctx.reply(err instanceof Error ? err.message : 'Cover letter failed.');
    }
  }

  @Action(/^cover:regen:(.+)$/)
  async onCoverRegen(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery('Regenerating…');
    try {
      const profile = await this.career.getOrCreateProfile(g.userId);
      const job = await this.jobs.findJobForUser(ctx.match[1]);
      const letter = await this.resume.generateCoverLetter(
        profile,
        job,
        ctx.from?.username,
      );
      const session = this.tg.getSession(g.telegramId);
      session.pendingJobId = job.id;
      session.pendingCoverText = letter;
      await ctx.reply(`✉️ COVER LETTER\n\n${letter}`, coverReviewKeyboard(job.id));
    } catch (err) {
      await ctx.reply(err instanceof Error ? err.message : 'Cover letter failed.');
    }
  }

  @Action(/^cover:save:(.+)$/)
  async onCoverSave(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    const session = this.tg.getSession(g.telegramId);
    if (!session.pendingCoverText || session.pendingJobId !== ctx.match[1]) {
      await ctx.answerCbQuery('Nothing to save');
      return;
    }
    await this.applications.saveCoverLetter(
      g.userId,
      ctx.match[1],
      session.pendingCoverText,
    );
    session.pendingCoverText = undefined;
    await ctx.answerCbQuery('Saved');
    await ctx.reply('💾 Cover letter saved to the application tracker.');
  }

  @Action(/^cover:edit:(.+)$/)
  async onCoverEdit(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    const session = this.tg.getSession(g.telegramId);
    session.mode = TelegramSessionMode.AWAITING_COVER_EDIT;
    session.pendingJobId = ctx.match[1];
    await ctx.answerCbQuery();
    await ctx.reply('✏️ Send the complete edited cover letter.');
  }

  @Action(/^cover:cancel:(.+)$/)
  async onCoverCancel(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    const session = this.tg.getSession(g.telegramId);
    session.pendingCoverText = undefined;
    await ctx.answerCbQuery('Cancelled');
    await ctx.reply('❌ Cover letter discarded.');
  }

  @Action(/^net:card:(.+)$/)
  async onNetCard(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery();
    const all = await this.networking.findMatchesForUser(g.userId, { limit: 50 });
    const found = all.find((n) => n.personId === ctx.match[1] || n.person.id === ctx.match[1]);
    if (!found) {
      await ctx.reply('Opportunity not found.');
      return;
    }
    await ctx.reply(
      this.careerReport.formatPersonCard(
        found,
        1,
        (m: NetworkMatch) => this.netMatcher.describe(m),
      ),
      networkCardKeyboard(found.person.id, found.person.profileUrl),
    );
  }

  @Action(/^net:draft:(.+)$/)
  async onNetDraft(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery('Drafting…');
    try {
      const maxPerDay =
        this.config.get<number>('career.maxMessagesPerDay') ?? 10;
      const used = await this.netMessages.countToday(g.userId);
      if (used >= maxPerDay) {
        await ctx.reply(
          `Daily message limit reached (${maxPerDay}). Try again tomorrow.`,
        );
        return;
      }
      const all = await this.networking.findMatchesForUser(g.userId, { limit: 50 });
      const found = all.find((n) => n.personId === ctx.match[1] || n.person.id === ctx.match[1]);
      if (!found) {
        await ctx.reply('Opportunity not found.');
        return;
      }
      const profile = await this.career.getOrCreateProfile(g.userId);
      const draft = await this.netMessages.draft(
        g.userId,
        profile,
        found.person,
        ctx.from?.username,
      );
      const session = this.tg.getSession(g.telegramId);
      session.pendingMessageId = draft.id;
      session.pendingPersonId = found.person.id;
      await ctx.reply(
        `💬 Suggested message (DRAFT — nothing sent):\n\n${draft.message}`,
        messageReviewKeyboard(draft.id),
      );
    } catch (err) {
      await ctx.reply(err instanceof Error ? err.message : 'Draft failed.');
    }
  }

  @Action(/^net:ignore:(.+)$/)
  async onNetIgnore(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery('Ignored');
    await ctx.reply('❌ Opportunity ignored. Nothing was sent.');
  }

  @Action(/^msg:approve:(.+)$/)
  async onMsgApprove(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    try {
      const msg = await this.netMessages.setStatus(g.userId, ctx.match[1], 'APPROVED');
      const all = await this.networking.findMatchesForUser(g.userId, { limit: 50 });
      const person = all.find((n) => n.person.id === msg.personId)?.person;
      await ctx.answerCbQuery('Approved');
      await ctx.reply(
        `✅ Approved. No API can send this — copy it and send manually on LinkedIn:\n\n${msg.message}`,
        messageApprovedKeyboard(msg.id, person?.profileUrl),
      );
    } catch {
      await ctx.answerCbQuery('Approve failed');
    }
  }

  @Action(/^msg:regen:(.+)$/)
  async onMsgRegen(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery('Regenerating…');
    try {
      const old = await this.netMessages.setStatus(g.userId, ctx.match[1], 'SKIPPED');
      const profile = await this.career.getOrCreateProfile(g.userId);
      const all = await this.networking.findMatchesForUser(g.userId, { limit: 50 });
      const found = all.find((n) => n.person.id === old.personId);
      if (!found) {
        await ctx.reply('Opportunity not found.');
        return;
      }
      const draft = await this.netMessages.draft(
        g.userId,
        profile,
        found.person,
        ctx.from?.username,
      );
      const session = this.tg.getSession(g.telegramId);
      session.pendingMessageId = draft.id;
      await ctx.reply(
        `💬 Suggested message (DRAFT — nothing sent):\n\n${draft.message}`,
        messageReviewKeyboard(draft.id),
      );
    } catch (err) {
      await ctx.reply(err instanceof Error ? err.message : 'Regenerate failed.');
    }
  }

  @Action(/^msg:edit:(.+)$/)
  async onMsgEdit(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    const session = this.tg.getSession(g.telegramId);
    session.mode = TelegramSessionMode.AWAITING_MESSAGE_EDIT;
    session.pendingMessageId = ctx.match[1];
    await ctx.answerCbQuery();
    await ctx.reply('✏️ Send the complete edited message.');
  }

  @Action(/^msg:cancel:(.+)$/)
  async onMsgCancel(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    try {
      await this.netMessages.setStatus(g.userId, ctx.match[1], 'SKIPPED');
      await ctx.answerCbQuery('Discarded');
      await ctx.reply('❌ Draft discarded. Nothing was sent.');
    } catch {
      await ctx.answerCbQuery('Failed');
    }
  }

  @Action(/^msg:sent:(.+)$/)
  async onMsgSent(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    // Manual send confirmed by the user in Telegram — never an API call.
    try {
      await this.netMessages.setStatus(g.userId, ctx.match[1], 'SENT');
      await ctx.answerCbQuery('Recorded');
      await ctx.reply('✅ Recorded as sent manually.');
    } catch {
      await ctx.answerCbQuery('Failed');
    }
  }
}
