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
import { Job } from '../../jobs/entities/job.entity';

export type ApplicationStatus =
  | 'SAVED'
  | 'REVIEW'
  | 'APPROVED'
  | 'APPLIED'
  | 'INTERVIEW'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'UNKNOWN';

/**
 * Manual application tracker. APPLIED is set ONLY when the user explicitly
 * taps "Mark as Applied" — the system never submits applications itself.
 */
@Entity('applications')
@Index('IDX_applications_userId', ['userId'])
@Index('IDX_applications_status', ['status'])
@Index('IDX_applications_user_job', ['userId', 'jobId'], { unique: true })
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  jobId!: string;

  @ManyToOne(() => Job, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job!: Job;

  @Column({ type: 'varchar', length: 16, default: 'SAVED' })
  status!: ApplicationStatus;

  @Column({ type: 'timestamptz', nullable: true })
  appliedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  applicationUrl!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  resumeVersion!: string | null;

  @Column({ type: 'text', nullable: true })
  coverLetter!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastFollowUpAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
