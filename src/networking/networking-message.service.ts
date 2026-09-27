import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConnectionMessage } from './entities/connection-message.entity';
import { OpenRouterClient } from '../ai/openrouter.client';
import { CareerProfile } from '../career/entities/career-profile.entity';
import { Person } from './entities/person.entity';

const MESSAGE_SYSTEM = `You write a short, natural professional connection message (max 120 words).
Use ONLY the facts provided. Do NOT claim the sender knows the recipient.
Do NOT invent shared connections, previous conversations, or admiration.
Do NOT be spammy. Plain text only.`;

/**
 * Drafts connection messages (DRAFT status). Sending is never automated:
 * with no permitted send API, approved messages are copied by the user
 * from Telegram and sent manually on LinkedIn.
 */
@Injectable()
export class NetworkingMessageService {
  private readonly logger = new Logger(NetworkingMessageService.name);

  constructor(
    @InjectRepository(ConnectionMessage)
    private readonly messages: Repository<ConnectionMessage>,
    private readonly openrouter: OpenRouterClient,
  ) {}

  async draft(
    userId: string,
    profile: CareerProfile,
    person: Person,
    userName?: string,
  ): Promise<ConnectionMessage> {
    const existing = await this.messages.findOne({
      where: { userId, personId: person.id, status: 'DRAFT' },
      order: { createdAt: 'DESC' },
    });
    if (existing) return existing;
    try {
      const text = await this.openrouter.chat([
        { role: 'system', content: MESSAGE_SYSTEM },
        {
          role: 'user',
          content:
            `Sender: ${userName ?? 'a developer'}\n` +
            `Sender stack: ${(profile.skills ?? []).join(', ') || 'unknown'}\n` +
            `Sender roles: ${(profile.targetRoles ?? []).join(', ') || 'unknown'}\n` +
            `Recipient: ${person.jobTitle ?? 'professional'} at ${person.company ?? 'unknown company'}\n` +
            `Context: ${person.headline ?? 'shared technical interests'}`,
        },
      ]);
      return this.messages.save(
        this.messages.create({
          userId,
          personId: person.id,
          message: text.trim().slice(0, 1500),
          status: 'DRAFT',
        }),
      );
    } catch (err) {
      this.logger.warn(
        `Message draft failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new Error(
        'Message drafting is unavailable right now (AI service failed). No content was generated.',
      );
    }
  }

  async setStatus(
    userId: string,
    messageId: string,
    status: 'APPROVED' | 'SKIPPED' | 'FAILED' | 'SENT',
  ): Promise<ConnectionMessage> {
    const msg = await this.messages.findOne({
      where: { id: messageId },
    });
    if (!msg || msg.userId !== userId) throw new Error('Message not found');
    msg.status = status;
    return this.messages.save(msg);
  }

  async latestDraft(
    userId: string,
    personId: string,
  ): Promise<ConnectionMessage | null> {
    return this.messages.findOne({
      where: { userId, personId, status: 'DRAFT' },
      order: { createdAt: 'DESC' },
    });
  }

  async updateDraftText(
    userId: string,
    messageId: string,
    text: string,
  ): Promise<ConnectionMessage> {
    const msg = await this.messages.findOne({ where: { id: messageId } });
    if (!msg || msg.userId !== userId || msg.status !== 'DRAFT') {
      throw new Error('Draft message not found');
    }
    msg.message = text.slice(0, 1500);
    return this.messages.save(msg);
  }

  /** Drafts/approvals created today (anti-spam cap for MAX_MESSAGES_PER_DAY). */
  async countToday(userId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.messages
      .createQueryBuilder('m')
      .where('m.userId = :userId', { userId })
      .andWhere('m.createdAt >= :start', { start })
      .andWhere("m.status != 'SKIPPED'")
      .getCount();
  }
}
