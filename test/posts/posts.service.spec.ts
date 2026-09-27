import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PostsService } from '../../src/posts/posts.service';
import { LinkedInPost } from '../../src/posts/entities/linkedin-post.entity';
import { PostEdit } from '../../src/posts/entities/post-edit.entity';
import { PostStatus } from '../../src/common/constants/post-status.enum';
import { PostStyle } from '../../src/common/constants/post-style.enum';

function mockRepo<T extends object>(impl: Partial<Record<string, jest.Mock>> = {}) {
  return {
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => v),
    findOne: jest.fn(),
    find: jest.fn(async () => []),
    createQueryBuilder: jest.fn(),
    ...impl,
  };
}

describe('PostsService state transitions', () => {
  let service: PostsService;
  const postsRepo = mockRepo();
  const editsRepo = mockRepo();
  const txRepo = mockRepo();
  const txEditRepo = mockRepo();
  const dataSource = {
    transaction: jest.fn(async (fn: (m: { getRepository: () => unknown }) => unknown) =>
      fn({ getRepository: () => txRepo }),
    ),
    createQueryRunner: jest.fn(),
  } as unknown as DataSource;
  const ai = {
    generatePost: jest.fn(async () => ({ content: 'generated post #tag', model: 'openrouter/free' })),
    buildHistorySummary: jest.fn(() => ''),
  } as never;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getRepositoryToken(LinkedInPost), useValue: postsRepo },
        { provide: getRepositoryToken(PostEdit), useValue: editsRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: 'AiService', useValue: ai },
      ],
    })
      .overrideProvider(PostsService)
      .useFactory({
        factory: () =>
          new PostsService(postsRepo as never, editsRepo as never, ai as never, dataSource),
      })
      .compile();
    service = module.get<PostsService>(PostsService);
  });

  it('approve moves PENDING_APPROVAL -> APPROVED', async () => {
    txRepo.findOne.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      status: PostStatus.PENDING_APPROVAL,
    });
    txRepo.save.mockImplementation(async (v: unknown) => v);
    const out = await service.approve('p1', 'u1');
    expect(out.status).toBe(PostStatus.APPROVED);
  });

  it('approve rejects foreign post', async () => {
    txRepo.findOne.mockResolvedValue({ id: 'p1', userId: 'other', status: PostStatus.DRAFT });
    await expect(service.approve('p1', 'u1')).rejects.toThrow();
  });

  it('schedule rejects past dates', async () => {
    await expect(
      service.schedule('p1', 'u1', new Date(Date.now() - 1000)),
    ).rejects.toThrow('future');
  });

  it('edit stores PostEdit and updates content', async () => {
    const fakeTx = {
      getRepository: (e: unknown) => (e === LinkedInPost ? txRepo : txEditRepo),
    };
    (dataSource.transaction as jest.Mock).mockImplementationOnce(
      async (fn: (m: unknown) => unknown) => fn(fakeTx),
    );
    txRepo.findOne.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      content: 'old',
      status: PostStatus.APPROVED,
    });
    txEditRepo.create.mockImplementation((v: unknown) => v);
    txEditRepo.save.mockImplementation(async (v: unknown) => v);
    txRepo.save.mockImplementation(async (v: unknown) => v);
    const out = await service.edit('p1', 'u1', 'new content');
    expect(txEditRepo.save).toHaveBeenCalled();
    expect(out.content).toBe('new content');
  });

  it('create defaults style', async () => {
    postsRepo.create.mockImplementation((v: unknown) => v);
    postsRepo.save.mockImplementation(async (v: unknown) => v);
    const out = await service.create('u1', { content: 'hello' });
    expect(out.style).toBe(PostStyle.SOMETHING_I_LEARNED);
  });
});
