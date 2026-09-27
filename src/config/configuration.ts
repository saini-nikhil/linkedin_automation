export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL ?? '',
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_DATABASE ?? 'linkedin_automation',
    ssl: (process.env.DB_SSL ?? 'true').toLowerCase() !== 'false',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    allowedUserId: process.env.TELEGRAM_ALLOWED_USER_ID ?? '',
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
    model: process.env.OPENROUTER_MODEL ?? 'openrouter/free',
    baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  },
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID ?? '',
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? '',
    redirectUri:
      process.env.LINKEDIN_REDIRECT_URI ??
      'http://localhost:3000/linkedin/oauth/callback',
    apiVersion: process.env.LINKEDIN_API_VERSION ?? '202608',
  },
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  timezone: process.env.TIMEZONE ?? 'Asia/Kolkata',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  career: {
    maxJobsPerSource: parseInt(process.env.MAX_JOBS_PER_SOURCE ?? '30', 10),
    maxMatchedJobsPerDay: parseInt(
      process.env.MAX_MATCHED_JOBS_PER_DAY ?? '20',
      10,
    ),
    maxNetworkingMatchesPerDay: parseInt(
      process.env.MAX_NETWORKING_MATCHES_PER_DAY ?? '10',
      10,
    ),
    maxMessagesPerDay: parseInt(process.env.MAX_MESSAGES_PER_DAY ?? '10', 10),
  },
  content: {
    maxRegenerations: parseInt(process.env.MAX_REGENERATIONS ?? '3', 10),
  },
});
