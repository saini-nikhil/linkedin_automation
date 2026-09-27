import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  LinkedInMember,
  LinkedInPostResult,
  LinkedInTokenResponse,
} from './types';
import {
  escapeLinkedInCommentary,
  getLinkedInTextStats,
  sanitizeLinkedInText,
  validateLinkedInText,
} from './utils/linkedin-text.util';

// Official LinkedIn API endpoints (verified Sept 2024+ / 2025 docs):
// - OAuth: https://www.linkedin.com/oauth/v2/authorization + /accessToken
// - OpenID userinfo: https://api.linkedin.com/v2/userinfo
// - Posts: POST https://api.linkedin.com/v2/ugcPosts (legacy) and
//   POST https://api.linkedin.com/rest/posts (versioned, preferred Dec 2023+).
// We implement the versioned /rest/posts endpoint primarily, with w_member_social
// + openid + profile + email scopes. If LinkedIn changes requirements, update here only.
const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const LINKEDIN_POSTS_URL = 'https://api.linkedin.com/rest/posts';
// LinkedIn versions are YYYYMM, released monthly, supported ~12 months.
// A sunset version returns 426 NONEXISTENT_VERSION, so keep this pinned to a
// recent released month and bump every ~6 months. Do NOT compute from clock
// (a future month also returns 426). Verified active Sept 2026: 202608.
// Overridable via LINKEDIN_API_VERSION env without a code change.
const DEFAULT_LINKEDIN_API_VERSION = '202608';

@Injectable()
export class LinkedInClient {
  private readonly logger = new Logger(LinkedInClient.name);

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  private get clientId(): string {
    return this.config.get<string>('linkedin.clientId') ?? '';
  }

  private get clientSecret(): string {
    return this.config.get<string>('linkedin.clientSecret') ?? '';
  }

  private get redirectUri(): string {
    return (
      this.config.get<string>('linkedin.redirectUri') ??
      'http://localhost:3000/linkedin/oauth/callback'
    );
  }

  private get apiVersion(): string {
    return (
      this.config.get<string>('linkedin.apiVersion') ??
      DEFAULT_LINKEDIN_API_VERSION
    );
  }

  getAuthorizationUrl(state: string): string {
    const scopes = ['openid', 'profile', 'email', 'w_member_social'];
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      state,
    });
    return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<LinkedInTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
    });
    const res = await firstValueFrom(
      this.http.post(LINKEDIN_TOKEN_URL, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000,
      }),
    );
    return res.data as LinkedInTokenResponse;
  }

  async refreshAccessToken(refreshToken: string): Promise<LinkedInTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const res = await firstValueFrom(
      this.http.post(LINKEDIN_TOKEN_URL, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000,
      }),
    );
    return res.data as LinkedInTokenResponse;
  }

  async getCurrentMember(accessToken: string): Promise<LinkedInMember> {
    const res = await firstValueFrom(
      this.http.get(LINKEDIN_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 30000,
      }),
    );
    return res.data as LinkedInMember;
  }

  /** Create a text-only member post via the versioned Posts API. */
  async createTextPost(
    accessToken: string,
    memberId: string,
    text: string,
  ): Promise<LinkedInPostResult> {
    // Canonical content: the SAME text Telegram previewed. Sanitize + validate,
    // never silently truncate. Escaping below is wire-format only (little-text).
    const canonical = sanitizeLinkedInText(text);
    validateLinkedInText(canonical);
    const stats = getLinkedInTextStats(canonical);
    this.logger.log(
      `LinkedIn publish: chars=${stats.chars} lines=${stats.lines} ` +
        `head=${JSON.stringify(stats.first80)} tail=${JSON.stringify(stats.last80)}`,
    );
    const payload = {
      author: `urn:li:person:${memberId}`,
      commentary: escapeLinkedInCommentary(canonical),
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };
    try {
      this.logger.log(
        `Posting ${stats.chars} chars with LinkedIn-Version=${this.apiVersion}`,
      );
      const res = await firstValueFrom(
        this.http.post(LINKEDIN_POSTS_URL, payload, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'LinkedIn-Version': this.apiVersion,
            'X-Restli-Protocol-Version': '2.0.0',
          },
          timeout: 30000,
        }),
      );
      const id =
        (res.headers?.['x-restli-id'] as string | undefined) ??
        (res.data?.id as string | undefined) ??
        (res.data?.urn as string | undefined) ??
        'unknown';
      return { id: String(id) };
    } catch (err) {
      const axiosErr = err as {
        message?: string;
        response?: { status?: number; data?: unknown; headers?: unknown };
      };
      const status = axiosErr.response?.status;
      const data = axiosErr.response?.data;
      const rawDetail =
        typeof data === 'string' ? data : JSON.stringify(data ?? '');
      const detail = rawDetail.slice(0, 1500);
      if (status === 426) {
        this.logger.error(
          `LinkedIn post failed 426 NONEXISTENT_VERSION: ` +
            `LinkedIn-Version=${this.apiVersion} is retired or unreleased. ` +
            `Bump LINKEDIN_API_VERSION to a recent released YYYYMM (e.g. 202608). ` +
            `Response: ${detail}`,
        );
      } else {
        this.logger.error(
          `LinkedIn post failed: ${err instanceof Error ? err.message : String(err)}` +
            (status ? ` status=${status}` : '') +
            (detail && detail !== '{}' ? ` response=${detail}` : ''),
        );
      }
      throw err;
    }
  }

  isTokenExpired(expiresAt: Date | null | undefined): boolean {
    if (!expiresAt) return false;
    // 5-minute safety margin.
    return new Date(expiresAt).getTime() - 5 * 60 * 1000 <= Date.now();
  }
}
