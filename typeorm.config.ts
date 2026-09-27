import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from './src/users/entities/user.entity';
import { LearningNote } from './src/learning/entities/learning-note.entity';
import { LinkedInPost } from './src/posts/entities/linkedin-post.entity';
import { PostEdit } from './src/posts/entities/post-edit.entity';
import { OAuthState } from './src/linkedin/entities/oauth-state.entity';

dotenv.config();

function buildOptions() {
  const url = process.env.DATABASE_URL;
  if (url) {
    return {
      type: 'postgres' as const,
      url,
      entities: [User, LearningNote, LinkedInPost, PostEdit, OAuthState],
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
    entities: [User, LearningNote, LinkedInPost, PostEdit, OAuthState],
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
