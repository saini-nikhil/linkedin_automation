import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { LinkedInPost } from './entities/linkedin-post.entity';
import { DailyContentGeneration } from './entities/daily-content-generation.entity';
import { PostStatus } from '../common/constants/post-status.enum';
import { PostStyle } from '../common/constants/post-style.enum';
import { OpenRouterClient } from '../ai/openrouter.client';
import { AiService } from '../ai/ai.service';
import { PostQualityService } from './post-quality.service';
import { CareerService, istDateString } from '../career/career.service';
import {
  TECH_CATEGORIES,
  TOPIC_POOLS,
  WEEKDAY_CATEGORIES,
  TechCategory,
} from './content-categories';
import {
  TECH_CONTENT_PROMPT_VERSION,
  TECH_CONTENT_SYSTEM_PROMPT,
  buildDailyTechUserPrompt,
} from './prompts/daily-tech.prompt';
import {
  sanitizeLinkedInText,
  validateLinkedInText,
} from '../linkedin/utils/linkedin-text.util';

export interface DailyGenerationResult {
  post: LinkedInPost;
  daily: DailyContentGeneration;
  /** False when quality failed twice — preview must NOT be published. */
  ok: boolean;
  qualityFailures?: string[];
}

function normalizeTopic(t: string | null | undefined): string {
  return (t ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function istWeekday(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(`${parts}T12:00:00Z`).getUTCDay();
}

/**
 * Daily tech-post pipeline: topic selection (rotation + 20-topic history),
 * OpenRouter generation, sanitize + validate, quality gate with one auto
 * retry. Never publishes — preview + approval happen in Telegram.
 */
@Injectable()
export class DailyContentService {
  private readonly logger = new Logger(DailyContentService.name);

  constructor(
    @InjectRepository(LinkedInPost)
    private readonly posts: Repository<LinkedInPost>,
    @InjectRepository(DailyContentGeneration)
    private readonly daily: Repository<DailyContentGeneration>,
    private readonly openrouter: OpenRouterClient,
    private readonly ai: AiService,
    private readonly quality: PostQualityService,
    private readonly career: CareerService,
    private readonly config: ConfigService,
  ) {}

  /** Create today's draft. Returns existing row when already generated. */
  async generateDailyPost(
    userId: string,
    dateStr = istDateString(),
  ): Promise<DailyGenerationResult | null> {
    const existing = await this.daily.findOne({
      where: { userId, generationDate: dateStr },
      relations: ['post'],
    });
    if (existing?.post) {
      this.logger.log(
        `Daily draft already exists for user ${userId} on ${dateStr} — skipping`,
      );
      return {
        post: existing.post,
        daily: existing,
        ok: existing.status !== 'FAILED',
      };
    }

    const { topic, category } = await this.pickTopic(userId);
    const skillsContext = await this.skillsContext(userId);
    const historySummary = await this.historySummary(userId);
    let text: string | null = null;
    let model = this.openrouter.getModel();
    let failures: string[] = [];

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await this.openrouter.chat([
          { role: 'system', content: TECH_CONTENT_SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildDailyTechUserPrompt({
              topic,
              category,
              historySummary,
              skillsContext,
              strictRetry: attempt === 1,
            }),
          },
        ]);
        model = this.openrouter.getModel();
        const canonical = sanitizeLinkedInText(raw);
        validateLinkedInText(canonical);
        const q = this.quality.check(canonical, await this.recentTopics(userId));
        if (q.pass) {
          text = canonical;
          failures = [];
          break;
        }
        failures = q.failures;
        this.logger.warn(
          `Daily draft quality failed (attempt ${attempt + 1}): ${q.failures.join(', ')}`,
        );
      } catch (err) {
        failures = [err instanceof Error ? err.message : String(err)];
        this.logger.warn(`Daily generation attempt ${attempt + 1} failed: ${failures[0]}`);
      }
    }

    if (text === null) {
      const post = await this.posts.save(
        this.posts.create({
          userId,
          learningNoteId: null,
          content: 'daily generation failed — see errorMessage',
          style: PostStyle.SOMETHING_I_LEARNED,
          status: PostStatus.FAILED,
          topic,
          topicCategory: category,
          generationModel: model,
          promptVersion: TECH_CONTENT_PROMPT_VERSION,
          errorMessage: `Quality/unavailable: ${failures.join('; ')}`.slice(0, 2000),
        }),
      );
      const daily = await this.saveDailyRow(userId, dateStr, {
        postId: post.id,
        topic,
        category,
        model,
        status: 'FAILED',
        qualityScore: 0,
      });
      return { post, daily, ok: false, qualityFailures: failures };
    }

    const post = await this.posts.save(
      this.posts.create({
        userId,
        learningNoteId: null,
        content: text,
        style: PostStyle.SOMETHING_I_LEARNED,
        status: PostStatus.PENDING_APPROVAL,
        topic,
        topicCategory: category,
        generationModel: model,
        promptVersion: TECH_CONTENT_PROMPT_VERSION,
        sourceUrls: [],
        errorMessage: null,
      }),
    );
    const daily = await this.saveDailyRow(userId, dateStr, {
      postId: post.id,
      topic,
      category,
      model,
      status: 'PENDING_APPROVAL',
      qualityScore: this.quality.check(text).score,
    });
    this.logger.log(
      `Daily draft ready for user ${userId} on ${dateStr}: topic="${topic}" category=${category}`,
    );
    return { post, daily, ok: true };
  }

  /** Regenerate an existing daily draft with a completely new angle. */
  async regenerateDailyPost(userId: string, postId: string): Promise<LinkedInPost> {
    const daily = await this.daily.findOne({ where: { postId } });
    if (!daily || daily.userId !== userId) {
      throw new Error('Not a daily post');
    }
    const post = await this.posts.findOne({ where: { id: postId } });
    if (!post || post.userId !== userId) throw new Error('Post not found');
    const skillsContext = await this.skillsContext(userId);
    const historySummary = await this.historySummary(userId, postId);
    const raw = await this.openrouter.chat([
      { role: 'system', content: TECH_CONTENT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildDailyTechUserPrompt({
          topic: daily.topic ?? 'backend engineering',
          category: daily.category ?? 'CONCEPT_EXPLAINED',
          historySummary,
          skillsContext,
          strictRetry: true,
        }),
      },
    ]);
    const canonical = sanitizeLinkedInText(raw);
    validateLinkedInText(canonical);
    const q = this.quality.check(canonical, await this.recentTopics(userId));
    if (!q.pass) {
      throw new Error(`Regenerated draft failed quality: ${q.failures.join(', ')}`);
    }
    post.content = canonical;
    post.generationModel = this.openrouter.getModel();
    post.promptVersion = TECH_CONTENT_PROMPT_VERSION;
    post.status = PostStatus.PENDING_APPROVAL;
    post.errorMessage = null;
    daily.status = 'PENDING_APPROVAL';
    daily.qualityScore = q.score;
    await this.daily.save(daily);
    return this.posts.save(post);
  }

  /**
   * Regen gate for Telegram onRegen. No-op for non-daily posts.
   * Returns allowed=false once MAX_REGENERATIONS is reached.
   */
  async noteRegeneration(
    userId: string,
    postId: string,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const max = this.config.get<number>('content.maxRegenerations') ?? 3;
    const daily = await this.daily.findOne({ where: { postId } });
    if (!daily || daily.userId !== userId) return { allowed: true, remaining: max };
    if (daily.regenerationCount >= max) return { allowed: false, remaining: 0 };
    daily.regenerationCount += 1;
    await this.daily.save(daily);
    return { allowed: true, remaining: max - daily.regenerationCount };
  }

  /** Mirror post lifecycle onto the daily row (best-effort, never throws). */
  async reflectPostStatus(postId: string): Promise<void> {
    try {
      const daily = await this.daily.findOne({ where: { postId } });
      if (!daily) return;
      const post = await this.posts.findOne({ where: { id: postId } });
      if (!post) return;
      daily.status = post.status;
      await this.daily.save(daily);
    } catch {
      // Observability only — must never break publishing.
    }
  }

  async findByPost(postId: string): Promise<DailyContentGeneration | null> {
    return this.daily.findOne({ where: { postId } });
  }

  // ---------- topic selection ----------

  private async pickTopic(
    userId: string,
  ): Promise<{ topic: string; category: TechCategory }> {
    const weekday = istWeekday();
    const preferred = WEEKDAY_CATEGORIES[weekday] ?? [...TECH_CATEGORIES];
    const recentDaily = await this.daily.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    const recentCats = new Set(
      recentDaily.map((d) => d.category).filter(Boolean) as string[],
    );
    const lastUse = new Map<string, number>();
    recentDaily.forEach((d, i) => {
      if (d.topic && !lastUse.has(normalizeTopic(d.topic))) {
        lastUse.set(normalizeTopic(d.topic), i);
      }
    });
    const recentPosts = await this.posts.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    for (const p of recentPosts) {
      const key = normalizeTopic(p.topic ?? p.content.split('\n')[0].slice(0, 80));
      if (key && !lastUse.has(key)) lastUse.set(key, 999);
    }
    const usedTopics = new Set(lastUse.keys());
    const skills = await this.careerSkills(userId);

    const orderedCats = [
      ...preferred.filter((c) => !recentCats.has(c)),
      ...preferred.filter((c) => recentCats.has(c)),
      ...TECH_CATEGORIES.filter((c) => !preferred.includes(c as TechCategory)),
    ] as TechCategory[];
    for (const category of orderedCats) {
      const pool = TOPIC_POOLS[category] ?? [];
      const fresh = pool.filter((t) => !usedTopics.has(normalizeTopic(t)));
      if (fresh.length > 0) {
        fresh.sort((a, b) => this.skillOverlap(b, skills) - this.skillOverlap(a, skills));
        return { topic: fresh[0], category };
      }
    }
    // Everything recently used: fall back to least-recently-used topic.
    let best: { topic: string; category: TechCategory } = {
      topic: TOPIC_POOLS[preferred[0]][0],
      category: preferred[0],
    };
    let bestAge = -1;
    for (const category of TECH_CATEGORIES) {
      for (const topic of TOPIC_POOLS[category] ?? []) {
        const age = lastUse.get(normalizeTopic(topic)) ?? Number.MAX_SAFE_INTEGER;
        if (age > bestAge) {
          bestAge = age;
          best = { topic, category };
        }
      }
    }
    return best;
  }

  private skillOverlap(topic: string, skills: string[]): number {
    const t = topic.toLowerCase();
    return skills.filter((s) => s && t.includes(s.toLowerCase())).length;
  }

  private async careerSkills(userId: string): Promise<string[]> {
    try {
      const profile = await this.career.getOrCreateProfile(userId);
      return (profile.skills ?? []).map((s) => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  private async skillsContext(userId: string): Promise<string> {
    const skills = await this.careerSkills(userId);
    return skills.slice(0, 10).join(', ');
  }

  private async recentTopics(userId: string): Promise<string[]> {
    const rows = await this.daily.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return rows.map((r) => r.topic ?? '').filter(Boolean);
  }

  private async historySummary(
    userId: string,
    excludePostId?: string,
  ): Promise<string> {
    const history = await this.posts.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 15,
    });
    return this.ai.buildHistorySummary(
      history.filter((h) => h.id !== excludePostId),
    );
  }

  private async saveDailyRow(
    userId: string,
    dateStr: string,
    opts: {
      postId: string;
      topic: string;
      category: string;
      model: string;
      status: string;
      qualityScore: number;
    },
  ): Promise<DailyContentGeneration> {
    try {
      return await this.daily.save(
        this.daily.create({
          userId,
          generationDate: dateStr,
          postId: opts.postId,
          topic: opts.topic,
          category: opts.category,
          generationModel: opts.model,
          promptVersion: TECH_CONTENT_PROMPT_VERSION,
          sourceUrls: [],
          qualityScore: opts.qualityScore,
          regenerationCount: 0,
          status: opts.status,
        }),
      );
    } catch {
      // Concurrent tick won the unique constraint — return the winner's row.
      const winner = await this.daily.findOne({
        where: { userId, generationDate: dateStr },
      });
      if (!winner) throw new Error('Daily row claimed concurrently');
      return winner;
    }
  }
}
