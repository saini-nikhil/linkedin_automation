import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Person } from './person.entity';

export type ConnectionMessageStatus =
  | 'DRAFT'
  | 'APPROVED'
  | 'SENT'
  | 'SKIPPED'
  | 'FAILED';

/**
 * AI-drafted networking message. Stays DRAFT until the user explicitly
 * approves. SENT is set only for manual sends confirmed by the user —
 * there is no permitted API for auto-sending, and none is attempted.
 */
@Entity('connection_messages')
@Index('IDX_connection_messages_user_person', ['userId', 'personId'])
export class ConnectionMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  personId!: string;

  @ManyToOne(() => Person, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personId' })
  person!: Person;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status!: ConnectionMessageStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
