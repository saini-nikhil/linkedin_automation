import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from './src/users/entities/user.entity';
import { LearningNote } from './src/learning/entities/learning-note.entity';
import { LinkedInPost } from './src/posts/entities/linkedin-post.entity';
import { PostEdit } from './src/posts/entities/post-edit.entity';
import { OAuthState } from './src/linkedin/entities/oauth-state.entity';
import { CareerProfile } from './src/career/entities/career-profile.entity';
import { CareerScan } from './src/career/entities/career-scan.entity';
import { Job } from './src/jobs/entities/job.entity';
import { JobMatch } from './src/jobs/entities/job-match.entity';
import { Application } from './src/applications/entities/application.entity';
import { Person } from './src/networking/entities/person.entity';
import { NetworkMatch } from './src/networking/entities/network-match.entity';
import { ConnectionMessage } from './src/networking/entities/connection-message.entity';
import { DailyContentGeneration } from './src/posts/entities/daily-content-generation.entity';
import { PostAnalytics } from './src/posts/entities/post-analytics.entity';

const PHASE1_ENTITIES = [User, LearningNote, LinkedInPost, PostEdit, OAuthState];
const PHASE3_ENTITIES = [
  CareerProfile,
  CareerScan,
  Job,
  JobMatch,
  Application,
  Person,
  NetworkMatch,
  ConnectionMessage,
  DailyContentGeneration,
  PostAnalytics,
];

dotenv.config();

function buildOptions() {
  const url = process.env.DATABASE_URL;
  if (url) {
    return {
      type: 'postgres' as const,
      url,
      entities: [...PHASE1_ENTITIES, ...PHASE3_ENTITIES],
      migrations: ['database/migrations/*.js', 'database/migrations/*.ts'],
      synchronize: false,
      ssl: { rejectUnauthorized: false },
    };
  }
  return {
    type: 'postgres' as const,
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_DATABASE ?? 'linkedin_automation',
    entities: [...PHASE1_ENTITIES, ...PHASE3_ENTITIES],
    migrations: ['database/migrations/*.js', 'database/migrations/*.ts'],
    synchronize: false,
    ssl:
      (process.env.DB_SSL ?? 'true').toLowerCase() === 'false'
        ? false
        : { rejectUnauthorized: false },
  };
}

const AppDataSource = new DataSource(buildOptions());
export default AppDataSource;
