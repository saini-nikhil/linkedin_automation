import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.users.findOne({ where: { telegramId } });
  }

  async findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  /** All user ids (daily cron loops). */
  async findAllIds(): Promise<string[]> {
    const rows = await this.users.find({ select: ['id'] });
    return rows.map((r) => r.id);
  }

  /** Find or create a user row for a Telegram sender. Never stores tokens here. */
  async ensureFromTelegram(
    telegramId: string,
    username?: string,
  ): Promise<User> {
    let user = await this.findByTelegramId(telegramId);
    if (user) {
      if (username && user.telegramUsername !== username) {
        user.telegramUsername = username;
        await this.users.save(user);
      }
      return user;
    }
    user = this.users.create({ telegramId, telegramUsername: username ?? null });
    const saved = await this.users.save(user);
    this.logger.log(`Created user ${saved.id} for telegram ${telegramId}`);
    return saved;
  }

  /** Load user WITH LinkedIn tokens (entities hide them by default via select:false). */
  async findWithTokens(userId: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('u')
      .addSelect('u.linkedinAccessToken')
      .addSelect('u.linkedinRefreshToken')
      .where('u.id = :id', { id: userId })
      .getOne();
  }

  async saveLinkedInConnection(
    userId: string,
    data: {
      linkedinMemberId: string;
      accessToken: string;
      refreshToken?: string | null;
      expiresAt?: Date | null;
    },
  ): Promise<User> {
    const user = await this.findWithTokens(userId);
    if (!user) throw new Error('User not found');
    user.linkedinMemberId = data.linkedinMemberId;
    user.linkedinAccessToken = data.accessToken;
    user.linkedinRefreshToken = data.refreshToken ?? null;
    user.linkedinTokenExpiresAt = data.expiresAt ?? null;
    return this.users.save(user);
  }

  /** Public-safe profile (never includes tokens). */
  async getPublicProfile(userId: string) {
    const user = await this.findById(userId);
    if (!user) return null;
    return {
      id: user.id,
      telegramId: user.telegramId,
      telegramUsername: user.telegramUsername,
      linkedinMemberId: user.linkedinMemberId,
      linkedinConnected: Boolean(user.linkedinMemberId),
      createdAt: user.createdAt,
    };
  }
}
