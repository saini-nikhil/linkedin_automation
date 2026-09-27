import { LinkedInOAuthService } from '../../src/linkedin/linkedin.oauth.service';

describe('LinkedInOAuthService state single-use', () => {
  it('consumeState deletes after use', async () => {
    const entity = {
      id: 's1',
      userId: 'u1',
      state: 'abc',
      expiresAt: new Date(Date.now() + 60000),
    };
    const repo = {
      findOne: jest.fn(async () => entity),
      delete: jest.fn(async () => ({})),
    };
    const ds = {
      transaction: async (fn: (m: { getRepository: () => unknown }) => unknown) =>
        fn({ getRepository: () => repo }),
    } as never;
    const svc = new LinkedInOAuthService({} as never, ds);
    const out = await svc.consumeState('abc', 'u1');
    expect(out.state).toBe('abc');
    expect(repo.delete).toHaveBeenCalledWith({ id: 's1' });
  });

  it('rejects expired state', async () => {
    const repo = {
      findOne: jest.fn(async () => ({
        id: 's1',
        userId: 'u1',
        state: 'abc',
        expiresAt: new Date(Date.now() - 1000),
      })),
      delete: jest.fn(async () => ({})),
    };
    const ds = {
      transaction: async (fn: (m: { getRepository: () => unknown }) => unknown) =>
        fn({ getRepository: () => repo }),
    } as never;
    const svc = new LinkedInOAuthService({} as never, ds);
    await expect(svc.consumeState('abc')).rejects.toThrow('expired');
  });
});
