import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Networking opportunity discovered ONLY through permitted sources
 * (derived from matched hiring companies + manual LinkedIn search URLs).
 * Never scraped. Never auto-contacted.
 */
@Entity('persons')
@Index('IDX_persons_source_external', ['source', 'externalId'], {
  unique: true,
})
export class Person {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  source!: string;

  @Column({ type: 'varchar', length: 512 })
  externalId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  headline!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  company!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  jobTitle!: string | null;

  @Column({ type: 'text', nullable: true })
  profileUrl!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  skills!: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  location!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
