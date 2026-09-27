import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('databaseUrl', '');
        if (url) {
          return {
            type: 'postgres' as const,
            url,
            autoLoadEntities: true,
            synchronize: false,
            migrationsRun: false,
            ssl: { rejectUnauthorized: false },
          };
        }
        const host = config.get<string>('db.host', 'localhost');
        const port = config.get<number>('db.port', 5432);
        const username = config.get<string>('db.username', 'postgres');
        const password = config.get<string>('db.password', 'postgres');
        const database = config.get<string>('db.database', 'linkedin_automation');
        const ssl = config.get<boolean>('db.ssl', true);
        return {
          type: 'postgres' as const,
          host,
          port,
          username,
          password,
          database,
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: false,
          ssl: ssl ? { rejectUnauthorized: false } : false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
