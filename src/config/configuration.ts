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
});
