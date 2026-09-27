import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { LinkedInClient } from './linkedin.client';
import { LinkedInOAuthService } from './linkedin.oauth.service';

@Injectable()
export class LinkedInService {
  private readonly logger = new Logger(LinkedInService.name);

  constructor(
    private readonly client: LinkedInClient,
    private readonly oauth: LinkedInOAuthService,
    private readonly users: UsersService,
  ) {}

  async getConnectUrl(userId: string): Promise<string> {
    const state = await this.oauth.createState(userId);
    return this.client.getAuthorizationUrl(state.state);
  }

  async handleCallback(code: string, state: string) {
    const stateEntity = await this.oauth.consumeState(state);
    const tokens = await this.client.exchangeCodeForToken(code);
    const member = await this.client.getCurrentMember(tokens.access_token);
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;
    await this.users.saveLinkedInConnection(stateEntity.userId, {
      linkedinMemberId: member.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt,
    });
    this.logger.log(`LinkedIn connected for user ${stateEntity.userId}`);
    return { userId: stateEntity.userId, memberId: member.sub };
  }

  async ensureValidAccessToken(userId: string): Promise<{ token: string; memberId: string }> {
    const user = await this.users.findWithTokens(userId);
    if (!user?.linkedinAccessToken || !user.linkedinMemberId) {
      throw new Error('LinkedIn not connected. Send /linkedin in Telegram to connect.');
    }
    if (this.client.isTokenExpired(user.linkedinTokenExpiresAt)) {
      if (user.linkedinRefreshToken) {
        try {
          const refreshed = await this.client.refreshAccessToken(
            user.linkedinRefreshToken,
          );
          const expiresAt = refreshed.expires_in
            ? new Date(Date.now() + refreshed.expires_in * 1000)
            : null;
          await this.users.saveLinkedInConnection(userId, {
            linkedinMemberId: user.linkedinMemberId,
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token ?? user.linkedinRefreshToken,
            expiresAt,
          });
          return { token: refreshed.access_token, memberId: user.linkedinMemberId };
        } catch {
          throw new Error(
            '⚠️ Your LinkedIn connection needs to be renewed. Send /linkedin to reconnect.',
          );
        }
      }
      throw new Error(
        '⚠️ Your LinkedIn connection needs to be renewed. Send /linkedin to reconnect.',
      );
    }
    return { token: user.linkedinAccessToken, memberId: user.linkedinMemberId };
  }

  async publishTextPost(userId: string, text: string): Promise<string> {
    const { token, memberId } = await this.ensureValidAccessToken(userId);
    const result = await this.client.createTextPost(token, memberId, text);
    return result.id;
  }
}
