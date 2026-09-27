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
import { User } from '../../users/entities/user.entity';
import { LinkedInPost } from '../../posts/entities/linkedin-post.entity';

@Entity('learning_notes')
@Index('IDX_learning_notes_userId', ['userId'])
export class LearningNote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (u) => u.learningNotes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  topic!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => LinkedInPost, (p) => p.learningNote)
  posts!: LinkedInPost[];
}
