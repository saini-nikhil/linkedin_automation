import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LinkedInPost } from './linkedin-post.entity';

/**
 * One row per user per IST calendar day: exactly-one-daily-draft ledger.
 * Tracks topic/category history (dedupe), quality outcome and regen count.
 */
@Entity('daily_content_generations')
@Index('IDX_daily_content_user_date', ['userId', 'generationDate'], {
  unique: true,
})
@Index('IDX_daily_content_postId', ['postId'])
export class DailyContentGeneration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid', nullable: true })
  postId!: string | null;

  @ManyToOne(() => LinkedInPost, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'postId' })
  post!: LinkedInPost | null;

  /** IST calendar date (YYYY-MM-DD) of the 10:00 AM run. */
  @Column({ type: 'varchar', length: 10 })
  generationDate!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  topic!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  category!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  generationModel!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  promptVersion!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  sourceUrls!: string[];

  @Column({ type: 'int', nullable: true })
  qualityScore!: number | null;

  @Column({ type: 'int', default: 0 })
  regenerationCount!: number;

  @Column({ type: 'varchar', length: 32, default: 'DRAFT' })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
