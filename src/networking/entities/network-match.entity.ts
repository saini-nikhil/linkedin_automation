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
import { Person } from './person.entity';
import { CareerScan } from '../../career/entities/career-scan.entity';

@Entity('network_matches')
@Index('IDX_network_matches_userId', ['userId'])
@Index('IDX_network_matches_user_person', ['userId', 'personId'], {
  unique: true,
})
export class NetworkMatch {
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

  @Column({ type: 'uuid', nullable: true })
  scanId!: string | null;

  @ManyToOne(() => CareerScan, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'scanId' })
  scan!: CareerScan | null;

  @Column({ type: 'int', default: 0 })
  matchScore!: number;

  @Column({ type: 'text', array: true, default: '{}' })
  reasons!: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
