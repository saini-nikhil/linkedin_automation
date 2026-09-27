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
import { Job } from './job.entity';
import { CareerScan } from '../../career/entities/career-scan.entity';

/** Informational match score only — NOT a hiring guarantee. */
@Entity('job_matches')
@Index('IDX_job_matches_userId', ['userId'])
@Index('IDX_job_matches_jobId', ['jobId'])
@Index('IDX_job_matches_user_job', ['userId', 'jobId'], { unique: true })
export class JobMatch {
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

  @Column({ type: 'uuid', nullable: true })
  scanId!: string | null;

  @ManyToOne(() => CareerScan, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'scanId' })
  scan!: CareerScan | null;

  @Column({ type: 'int', default: 0 })
  matchScore!: number;

  @Column({ type: 'text', array: true, default: '{}' })
  matchedSkills!: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  missingSkills!: string[];

  @Column({ type: 'boolean', default: false })
  roleMatch!: boolean;

  @Column({ type: 'boolean', default: false })
  experienceMatch!: boolean;

  @Column({ type: 'boolean', default: false })
  locationMatch!: boolean;

  @Column({ type: 'boolean', default: false })
  workTypeMatch!: boolean;

  @Column({ type: 'boolean', default: false })
  salaryMatch!: boolean;

  @Column({ type: 'text', nullable: true })
  explanation!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
