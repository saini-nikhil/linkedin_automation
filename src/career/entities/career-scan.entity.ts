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

export type CareerScanStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

@Entity('career_scans')
@Index('IDX_career_scans_userId', ['userId'])
@Index('IDX_career_scans_user_scanDate', ['userId', 'scanDate'], {
  unique: true,
})
export class CareerScan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  /** IST calendar date (YYYY-MM-DD). Unique per user: prevents duplicate daily runs. */
  @Column({ type: 'varchar', length: 10 })
  scanDate!: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  jobsDiscovered!: number;

  @Column({ type: 'int', default: 0 })
  duplicatesRemoved!: number;

  @Column({ type: 'int', default: 0 })
  jobsMatched!: number;

  @Column({ type: 'int', default: 0 })
  networkingMatches!: number;

  @Column({ type: 'varchar', length: 16, default: 'RUNNING' })
  status!: CareerScanStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  /** Stored report text so /careerreport works even if Telegram send failed. */
  @Column({ type: 'text', nullable: true })
  reportText!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
