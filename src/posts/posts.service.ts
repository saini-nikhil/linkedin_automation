import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LinkedInPost } from './entities/linkedin-post.entity';
import { PostEdit } from './entities/post-edit.entity';
import { PostStatus } from '../common/constants/post-status.enum';
import { PostStyle } from '../common/constants/post-style.enum';
import { AiService } from '../ai/ai.service';
import { PROMPT_VERSION } from '../ai/prompts/linkedin-post.prompt';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectRepository(LinkedInPost)
    private readonly posts: Repository<LinkedInPost>,
    @InjectRepository(PostEdit)
    private readonly edits: Repository<PostEdit>,
    private readonly ai: AiService,
    private readonly dataSource: DataSource,
  ) {}

  private assertOwnership(post: LinkedInPost, userId: string) {
    if (post.userId !== userId) {
      throw new ForbiddenException('You do not own this post');
    }
  }

  async findForUser(
    userId: string,
    opts: { status?: PostStatus; page?: number; limit?: number } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const qb = this.posts
      .createQueryBuilder('p')
      .where('p.userId = :userId', { userId })
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (opts.status) qb.andWhere('p.status = :status', { status: opts.status });
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async findOneForUser(id: string, userId: string): Promise<LinkedInPost> {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    this.assertOwnership(post, userId);
    return post;
  }

  async create(userId: string, dto: CreatePostDto): Promise<LinkedInPost> {
    const post = this.posts.create({
      userId,
      learningNoteId: dto.learningNoteId ?? null,
      content: dto.content,
      style: dto.style ?? PostStyle.SOMETHING_I_LEARNED,
      status: PostStatus.DRAFT,
    });
    return this.posts.save(post);
  }

  async generate(
    postId: string,
    userId: string,
  ): Promise<LinkedInPost> {
    const post = await this.findOneForUser(postId, userId);
    post.status = PostStatus.GENERATING;
    await this.posts.save(post);
    try {
      const learningContent = post.content;
      const history = await this.posts.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 15,
      });
      const historySummary = this.ai.buildHistorySummary(
        history.filter((h) => h.id !== post.id),
      );
      const { content, model } = await this.ai.generatePost({
        learningContent,
        style: post.style,
        historySummary,
      });
      post.content = content;
      post.generationModel = model;
      post.promptVersion = PROMPT_VERSION;
      post.status = PostStatus.PENDING_APPROVAL;
      post.errorMessage = null;
      const saved = await this.posts.save(post);
      this.logger.log(`Post ${post.id} generated for user ${userId}`);
      return saved;
    } catch (err) {
      post.status = PostStatus.FAILED;
      post.errorMessage =
        err instanceof Error ? err.message.slice(0, 2000) : String(err);
      await this.posts.save(post);
      throw err;
    }
  }

  async generateFromLearningNote(
    userId: string,
    learningNoteId: string,
    content: string,
    style: PostStyle = PostStyle.SOMETHING_I_LEARNED,
  ): Promise<LinkedInPost> {
    const history = await this.posts.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 15,
    });
    let post = this.posts.create({
      userId,
      learningNoteId,
      content: 'pending generation...',
      style,
      status: PostStatus.GENERATING,
    });
    post = await this.posts.save(post);
    try {
      const { content: generated, model } = await this.ai.generatePost({
        learningContent: content,
        style,
        historySummary: this.ai.buildHistorySummary(history),
      });
      post.content = generated;
      post.generationModel = model;
      post.promptVersion = PROMPT_VERSION;
      post.status = PostStatus.PENDING_APPROVAL;
      return await this.posts.save(post);
    } catch (err) {
      post.status = PostStatus.FAILED;
      post.errorMessage =
        err instanceof Error ? err.message.slice(0, 2000) : String(err);
      await this.posts.save(post);
      throw err;
    }
  }

  async approve(id: string, userId: string): Promise<LinkedInPost> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(LinkedInPost);
      const post = await repo.findOne({ where: { id } });
      if (!post) throw new NotFoundException('Post not found');
      if (post.userId !== userId) throw new ForbiddenException('Not your post');
      if (
        post.status !== PostStatus.PENDING_APPROVAL &&
        post.status !== PostStatus.DRAFT &&
        post.status !== PostStatus.FAILED
      ) {
        throw new BadRequestException(
          `Cannot approve post in status ${post.status}`,
        );
      }
      post.status = PostStatus.APPROVED;
      post.errorMessage = null;
      return repo.save(post);
    });
  }

  async reject(id: string, userId: string): Promise<LinkedInPost> {
    const post = await this.findOneForUser(id, userId);
    post.status = PostStatus.REJECTED;
    return this.posts.save(post);
  }

  async regenerate(id: string, userId: string, style?: PostStyle): Promise<LinkedInPost> {
    const post = await this.findOneForUser(id, userId);
    // Regenerate uses the linked learning note content if available, else current content.
    // We keep the same row (version history via PostEdit is optional; edits track manual edits).
    post.status = PostStatus.GENERATING;
    if (style) post.style = style;
    await this.posts.save(post);
    try {
      const history = await this.posts.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 15,
      });
      const { content, model } = await this.ai.generatePost({
        learningContent: post.content,
        style: post.style,
        historySummary: this.ai.buildHistorySummary(
          history.filter((h) => h.id !== post.id),
        ),
      });
      post.content = content;
      post.generationModel = model;
      post.promptVersion = PROMPT_VERSION;
      post.status = PostStatus.PENDING_APPROVAL;
      post.errorMessage = null;
      return await this.posts.save(post);
    } catch (err) {
      post.status = PostStatus.FAILED;
      post.errorMessage =
        err instanceof Error ? err.message.slice(0, 2000) : String(err);
      await this.posts.save(post);
      throw err;
    }
  }

  async edit(id: string, userId: string, newContent: string): Promise<LinkedInPost> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(LinkedInPost);
      const editRepo = manager.getRepository(PostEdit);
      const post = await repo.findOne({ where: { id } });
      if (!post) throw new NotFoundException('Post not found');
      if (post.userId !== userId) throw new ForbiddenException('Not your post');
      const edit = editRepo.create({
        postId: post.id,
        oldContent: post.content,
        newContent,
      });
      await editRepo.save(edit);
      post.content = newContent;
      if (post.status === PostStatus.APPROVED || post.status === PostStatus.SCHEDULED) {
        post.status = PostStatus.PENDING_APPROVAL;
      }
      return repo.save(post);
    });
  }

  async schedule(id: string, userId: string, scheduledAt: Date): Promise<LinkedInPost> {
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(LinkedInPost);
      const post = await repo.findOne({ where: { id } });
      if (!post) throw new NotFoundException('Post not found');
      if (post.userId !== userId) throw new ForbiddenException('Not your post');
      if (post.status !== PostStatus.APPROVED && post.status !== PostStatus.PENDING_APPROVAL && post.status !== PostStatus.SCHEDULED) {
        throw new BadRequestException(
          `Cannot schedule post in status ${post.status}. Approve it first.`,
        );
      }
      post.scheduledAt = scheduledAt;
      post.status = PostStatus.SCHEDULED;
      post.errorMessage = null;
      return repo.save(post);
    });
  }

  /** Atomic claim used by the scheduler to avoid double-publish across instances. */
  async claimDuePost(postId: string): Promise<LinkedInPost | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const post = await queryRunner.manager
        .createQueryBuilder(LinkedInPost, 'p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id: postId })
        .getOne();
      if (!post || post.status !== PostStatus.SCHEDULED) {
        await queryRunner.rollbackTransaction();
        return null;
      }
      post.status = PostStatus.PUBLISHING;
      const saved = await queryRunner.manager.save(post);
      await queryRunner.commitTransaction();
      return saved;
    } catch {
      await queryRunner.rollbackTransaction();
      return null;
    } finally {
      await queryRunner.release();
    }
  }

  async findDuePosts(now: Date, limit = 20): Promise<LinkedInPost[]> {
    return this.posts
      .createQueryBuilder('p')
      .where('p.status = :status', { status: PostStatus.SCHEDULED })
      .andWhere('p.scheduledAt <= :now', { now })
      .orderBy('p.scheduledAt', 'ASC')
      .take(limit)
      .getMany();
  }

  async markPublished(id: string, linkedinPostId: string): Promise<LinkedInPost> {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    post.status = PostStatus.PUBLISHED;
    post.publishedAt = new Date();
    post.linkedinPostId = linkedinPostId;
    post.errorMessage = null;
    return this.posts.save(post);
  }

  async markFailed(id: string, error: string): Promise<LinkedInPost> {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    post.status = PostStatus.FAILED;
    post.errorMessage = error.slice(0, 2000);
    return this.posts.save(post);
  }

  async markPublishing(id: string, userId: string): Promise<LinkedInPost> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(LinkedInPost);
      const post = await repo.findOne({ where: { id } });
      if (!post) throw new NotFoundException('Post not found');
      if (post.userId !== userId) throw new ForbiddenException('Not your post');
      post.status = PostStatus.PUBLISHING;
      return repo.save(post);
    });
  }
}
