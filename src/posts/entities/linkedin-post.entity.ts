import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PostStatus } from '../../common/constants/post-status.enum';
import { PostStyle } from '../../common/constants/post-style.enum';
import { User } from '../../users/entities/user.entity';
import { LearningNote } from '../../learning/entities/learning-note.entity';
import { PostEdit } from './post-edit.entity';

@Entity('linkedin_posts')
@Index('IDX_linkedin_posts_userId', ['userId'])
@Index('IDX_linkedin_posts_status', ['status'])
@Index('IDX_linkedin_posts_scheduledAt', ['scheduledAt'])
@Index('IDX_linkedin_posts_user_status', ['userId', 'status'])
export class LinkedInPost {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (u) => u.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid', nullable: true })
  learningNoteId!: string | null;

  @ManyToOne(() => LearningNote, (n) => n.posts, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'learningNoteId' })
  learningNote!: LearningNote | null;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'enum', enum: PostStyle, default: PostStyle.SOMETHING_I_LEARNED })
  style!: PostStyle;

  @Column({ type: 'enum', enum: PostStatus, default: PostStatus.DRAFT })
  status!: PostStatus;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  linkedinPostId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  generationModel!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  promptVersion!: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  topic!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  topicCategory!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ type: 'text', array: true, default: '{}' })
  sourceUrls!: string[];

  @Column({ type: 'varchar', length: 32, nullable: true })
  rejectionReason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => PostEdit, (e) => e.post, { cascade: false })
  edits!: PostEdit[];
}
