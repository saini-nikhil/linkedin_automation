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
import { LinkedInService } from '../linkedin/linkedin.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { TelegramService } from './telegram.service';
import { TelegramSessionMode } from './telegram.states';
import {
  approvedKeyboard,
  collectingKeyboard,
  learningSavedKeyboard,
  postReviewKeyboard,
  scheduleKeyboard,
} from './telegram.keyboards';
import { PostStatus } from '../common/constants/post-status.enum';
import { PostStyle } from '../common/constants/post-style.enum';

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
    private readonly linkedin: LinkedInService,
    private readonly scheduler: SchedulerService,
    private readonly tg: TelegramService,
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
      '👋 Welcome!\n\nI can turn what you learn every day into LinkedIn posts.\n\nUse /learn to start.',
    );
  }

  @Help()
  @Command('help')
  async onHelp(@Ctx() ctx: Context) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.reply(
      '/learn - record what you learned\n/posts - recent posts\n/linkedin - connect LinkedIn\n/cancel - cancel current flow\n/help - this help',
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
    await this.posts.reject(ctx.match[1], g.userId);
    await ctx.answerCbQuery('Rejected');
    await ctx.reply('❌ Post rejected.\nThe post will not be published.');
  }

  @Action(/^regen:(.+)$/)
  async onRegen(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    const g = await this.guard(ctx);
    if (!g) return;
    await ctx.answerCbQuery('Regenerating…');
    try {
      const post = await this.posts.regenerate(ctx.match[1], g.userId);
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
}
