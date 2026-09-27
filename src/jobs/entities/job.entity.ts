import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('jobs')
@Index('IDX_jobs_source', ['source'])
@Index('IDX_jobs_source_external', ['source', 'externalId'], { unique: true })
@Index('IDX_jobs_jobUrl', ['jobUrl'])
@Index('IDX_jobs_postedAt', ['postedAt'])
@Index('IDX_jobs_createdAt', ['createdAt'])
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  source!: string;

  @Column({ type: 'varchar', length: 512 })
  externalId!: string;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  companyName!: string | null;

  @Column({ type: 'text', nullable: true })
  companyUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  jobUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  workType!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  employmentType!: string | null;

  @Column({ type: 'int', nullable: true })
  salaryMin!: number | null;

  @Column({ type: 'int', nullable: true })
  salaryMax!: number | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  currency!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  skills!: string[];

  @Column({ type: 'timestamptz', nullable: true })
  postedAt!: Date | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  firstSeenAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastSeenAt!: Date;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
