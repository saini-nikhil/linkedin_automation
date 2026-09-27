import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

class EnvVariables {
  @IsIn(['development', 'production', 'test'])
  @IsOptional()
  NODE_ENV?: string;

  @IsNumberString()
  @IsOptional()
  PORT?: string;

  // DATABASE_URL is required in production; optional in dev/test so unit tests
  // can run without a live Supabase connection.
  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @IsOptional()
  @IsString()
  TELEGRAM_BOT_TOKEN?: string;

  @IsOptional()
  @IsString()
  TELEGRAM_ALLOWED_USER_ID?: string;

  @IsOptional()
  @IsString()
  OPENROUTER_API_KEY?: string;

  @IsOptional()
  @IsString()
  OPENROUTER_MODEL?: string;

  @IsOptional()
  @IsString()
  LINKEDIN_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  LINKEDIN_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  LINKEDIN_REDIRECT_URI?: string;

  @IsOptional()
  @IsString()
  LINKEDIN_API_VERSION?: string;

  @IsNumberString()
  @IsOptional()
  MAX_JOBS_PER_SOURCE?: string;

  @IsNumberString()
  @IsOptional()
  MAX_MATCHED_JOBS_PER_DAY?: string;

  @IsNumberString()
  @IsOptional()
  MAX_NETWORKING_MATCHES_PER_DAY?: string;

  @IsNumberString()
  @IsOptional()
  MAX_MESSAGES_PER_DAY?: string;

  @IsNumberString()
  @IsOptional()
  MAX_REGENERATIONS?: string;

  @IsNotEmpty()
  @IsOptional()
  APP_BASE_URL?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const instance = plainToInstance(EnvVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(instance, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Config validation error: ${errors.toString()}`);
  }
  return instance;
}
