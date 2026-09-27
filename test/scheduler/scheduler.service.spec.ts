import { SchedulerService } from '../../src/scheduler/scheduler.service';
import { PostStatus } from '../../src/common/constants/post-status.enum';

describe('SchedulerService', () => {
  it('publishes due posts and marks PUBLISHED', async () => {
    const posts = {
      findDuePosts: jest.fn(async () => [
        { id: 'p1', userId: 'u1', content: 'hello', status: PostStatus.SCHEDULED },
      ]),
      claimDuePost: jest.fn(async () => ({
        id: 'p1',
        userId: 'u1',
        content: 'hello',
        status: PostStatus.PUBLISHING,
      })),
      markPublished: jest.fn(async (id: string, lid: string) => ({ id, linkedinPostId: lid })),
      markFailed: jest.fn(),
    };
    const postsTyped = posts as unknown as {
      markPublished: jest.Mock;
      markFailed: jest.Mock;
    };
    const linkedin = {
      publishTextPost: jest.fn(async () => 'urn:li:share:123'),
    } as never;
    const daily = { reflectPostStatus: jest.fn() } as never;
    const svc = new SchedulerService(posts as never, linkedin, daily);
    await svc.handleDuePosts();
    expect(postsTyped.markPublished).toHaveBeenCalledWith('p1', 'urn:li:share:123');
  });

  it('marks FAILED on LinkedIn error without deleting post', async () => {
    const posts = {
      findDuePosts: jest.fn(async () => [{ id: 'p1', userId: 'u1', content: 'x' }]),
      claimDuePost: jest.fn(async () => ({ id: 'p1', userId: 'u1', content: 'x' })),
      markPublished: jest.fn(),
      markFailed: jest.fn(async (id: string) => ({ id })),
    };
    const postsTyped = posts as unknown as {
      markPublished: jest.Mock;
      markFailed: jest.Mock;
    };
    const linkedin = {
      publishTextPost: jest.fn(async () => {
        throw new Error('403 forbidden');
      }),
    } as never;
    const daily = { reflectPostStatus: jest.fn() } as never;
    const svc = new SchedulerService(posts as never, linkedin, daily);
    await svc.handleDuePosts();
    expect(postsTyped.markFailed).toHaveBeenCalled();
    expect(postsTyped.markPublished).not.toHaveBeenCalled();
  });
});
