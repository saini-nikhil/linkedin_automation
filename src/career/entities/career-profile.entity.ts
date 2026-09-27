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

@Entity('career_profiles')
@Index('IDX_career_profiles_userId', ['userId'], { unique: true })
export class CareerProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'text', array: true, default: '{}' })
  targetRoles!: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  skills!: string[];

  @Column({ type: 'int', nullable: true })
  experienceYears!: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  workTypes!: string[];

  @Column({ type: 'int', nullable: true })
  salaryMin!: number | null;

  @Column({ type: 'int', nullable: true })
  salaryMax!: number | null;

  @Column({ type: 'varchar', length: 8, default: 'INR' })
  currency!: string;

  @Column({ type: 'int', nullable: true })
  noticePeriodDays!: number | null;

  @Column({ type: 'text', array: true, default: '{}' })
  employmentTypes!: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  targetCompanies!: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  excludedCompanies!: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  jobSourceUrls!: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
