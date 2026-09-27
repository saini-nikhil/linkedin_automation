import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LinkedInService } from './linkedin.service';

@Controller('linkedin')
export class LinkedInController {
  constructor(private readonly linkedin: LinkedInService) {}

  // Telegram bot resolves the real user; REST callers pass ?userId= (personal tool).
  @Get('oauth/start')
  async start(@Query('userId') userId: string) {
    const url = await this.linkedin.getConnectUrl(userId);
    return { url };
  }

  @Get('oauth/callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.linkedin.handleCallback(code, state);
      return res.status(200).send(
        `<h2>✅ LinkedIn connected</h2><p>User ${result.userId} linked to member ${result.memberId}. You can return to Telegram.</p>`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth failed';
      return res.status(400).send(`<h2>❌ LinkedIn connection failed</h2><p>${message}</p>`);
    }
  }
}
