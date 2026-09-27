import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LearningNote } from '../../learning/entities/learning-note.entity';
import { LinkedInPost } from '../../posts/entities/linkedin-post.entity';
import { OAuthState } from '../../linkedin/entities/oauth-state.entity';

@Entity('users')
@Index('IDX_users_telegramId', ['telegramId'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Stored as string to safely handle 64-bit Telegram IDs.
  @Column({ type: 'varchar', length: 32, unique: true })
  telegramId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  telegramUsername!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  linkedinMemberId!: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  linkedinAccessToken!: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  linkedinRefreshToken!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  linkedinTokenExpiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => LearningNote, (n) => n.user)
  learningNotes!: LearningNote[];

  @OneToMany(() => LinkedInPost, (p) => p.user)
  posts!: LinkedInPost[];

  @OneToMany(() => OAuthState, (s) => s.user)
  oauthStates!: OAuthState[];
}
