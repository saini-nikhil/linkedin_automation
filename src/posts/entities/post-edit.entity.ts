import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LinkedInPost } from './linkedin-post.entity';

@Entity('post_edits')
export class PostEdit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  postId!: string;

  @ManyToOne(() => LinkedInPost, (p) => p.edits, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post!: LinkedInPost;

  @Column({ type: 'text' })
  oldContent!: string;

  @Column({ type: 'text' })
  newContent!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
