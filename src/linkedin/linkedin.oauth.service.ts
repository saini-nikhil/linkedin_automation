import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { OAuthState } from './entities/oauth-state.entity';

const STATE_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class LinkedInOAuthService {
  private readonly logger = new Logger(LinkedInOAuthService.name);

  constructor(
    @InjectRepository(OAuthState)
    private readonly states: Repository<OAuthState>,
    private readonly dataSource: DataSource,
  ) {}

  async createState(userId: string): Promise<OAuthState> {
    // Cleanup expired states opportunistically.
    await this.states.delete({ expiresAt: LessThan(new Date()) }).catch(() => undefined);
    const state = randomBytes(32).toString('hex');
    const entity = this.states.create({
      userId,
      state,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    });
    return this.states.save(entity);
  }

  /** Validate + consume (single-use) an OAuth state inside a transaction. */
  async consumeState(state: string, userId?: string): Promise<OAuthState> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OAuthState);
      const entity = await repo.findOne({ where: { state } });
      if (!entity) throw new Error('Invalid OAuth state');
      if (entity.expiresAt.getTime() <= Date.now()) {
        await repo.delete({ id: entity.id });
        throw new Error('OAuth state expired');
      }
      if (userId && entity.userId !== userId) {
        throw new Error('OAuth state does not belong to this user');
      }
      await repo.delete({ id: entity.id });
      return entity;
    });
  }
}
