import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LinkedInPost } from './linkedin-post.entity';

/**
 * LinkedIn engagement analytics. Populated ONLY from real API data —
 * never invented. Stays empty while the app's permissions expose no
 * analytics endpoint.
 */
@Entity('post_analytics')
@Index('IDX_post_analytics_postId', ['postId'], { unique: true })
export class PostAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  postId!: string;

  @OneToOne(() => LinkedInPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post!: LinkedInPost;

  @Column({ type: 'int', default: 0 })
  impressions!: number;

  @Column({ type: 'int', default: 0 })
  reactions!: number;

  @Column({ type: 'int', default: 0 })
  comments!: number;

  @Column({ type: 'int', default: 0 })
  reposts!: number;

  @Column({ type: 'int', default: 0 })
  clicks!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  capturedAt!: Date;
}
