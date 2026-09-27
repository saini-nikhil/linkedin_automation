import { LearningService } from '../../src/learning/learning.service';

describe('LearningService', () => {
  it('trims content on create', async () => {
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ ...(v as object), id: 'n1' })),
      find: jest.fn(),
      findOne: jest.fn(),
    } as never;
    const svc = new LearningService(repo);
    const out = await svc.create('u1', { content: '  hello  ' });
    expect(out.content).toBe('hello');
  });
});
