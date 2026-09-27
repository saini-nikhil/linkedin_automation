import { LinkedInClient } from '../../src/linkedin/linkedin.client';

describe('LinkedInClient', () => {
  const config = {
    get: (k: string, d?: string) => {
      const map: Record<string, string> = {
        'linkedin.clientId': 'cid',
        'linkedin.clientSecret': 'csecret',
        'linkedin.redirectUri': 'http://localhost:3000/linkedin/oauth/callback',
      };
      return map[k] ?? d;
    },
  } as never;

  it('builds OAuth URL with required scopes', () => {
    const client = new LinkedInClient(config, {} as never);
    const url = client.getAuthorizationUrl('state123');
    expect(url).toContain('linkedin.com/oauth/v2/authorization');
    expect(decodeURIComponent(url)).toContain('w_member_social');
    expect(decodeURIComponent(url)).toContain('openid');
    expect(url).toContain('state123');
  });

  it('detects expired tokens with safety margin', () => {
    const client = new LinkedInClient(config, {} as never);
    expect(client.isTokenExpired(new Date(Date.now() - 1000))).toBe(true);
    expect(client.isTokenExpired(new Date(Date.now() + 3600_000))).toBe(false);
    expect(client.isTokenExpired(null)).toBe(false);
  });
});
