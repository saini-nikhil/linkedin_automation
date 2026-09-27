# linkedin-learning-automation

Telegram-controlled LinkedIn content automation: record daily learnings in Telegram,
generate authentic LinkedIn posts via OpenRouter, approve/edit/schedule, and publish
through the **official LinkedIn API**. Built with **NestJS + TypeScript + TypeORM +
Supabase PostgreSQL**. No scraping, no browser automation — only official OAuth/APIs.

## 1. Project overview

Flow: `Telegram → NestJS → Supabase → OpenRouter → Telegram approval → Scheduler → LinkedIn API`.

## 2. Architecture

- `src/config` — typed config + env validation (fail-fast)
- `src/users`, `src/learning`, `src/posts` — domain modules + TypeORM entities
- `src/ai` — `AiService` + `OpenRouterClient` (OpenAI-compatible, timeout + retry + 429 handling)
- `src/telegram` — Telegraf bot, auth guard, keyboards, session states
- `src/linkedin` — OAuth service, versioned Posts client (`/rest/posts`), controller
- `src/scheduler` — `@Cron('* * * * *')` DB-backed publisher with row-lock claim
- `src/health`, `src/common/filters`, `src/database`

## 3. Folder structure

See spec: `src/{config,common,database,health,users,learning,posts,ai,telegram,linkedin,scheduler}`,
`database/migrations`, `test/{learning,posts,ai,telegram,linkedin,scheduler}`.

## 4. Requirements

- Node.js 20+, npm 10+
- Supabase PostgreSQL database (or local Postgres for dev)
- Telegram bot token via [@BotFather](https://t.me/BotFather)
- OpenRouter API key
- LinkedIn developer app (see §12)

## 5. Node.js installation

```bash
node --version  # >= 20
npm install
```

## 6. Supabase setup

1. Create project at https://supabase.com → get **Connection string** (URI).
2. Use the **Transaction / Session pooler** URL for app runtime, or direct connection.
3. Enable `pgcrypto` (migration does `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`).
4. Paste URL into `DATABASE_URL`.

## 7. PostgreSQL connection setup

Prefer `DATABASE_URL`. Fallback: `DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_DATABASE/DB_SSL`.
SSL: Supabase requires SSL — config uses `ssl: { rejectUnauthorized: false }`.
`synchronize` is **always false**; schema comes from migrations only.

## 8. TypeORM setup

- `src/database/database.module.ts` — `forRootAsync` with ConfigService.
- `typeorm.config.ts` — CLI DataSource (same entities, `database/migrations/*`).
- Entities use UUID PKs, `Create/UpdateDateColumn`, enums, indexes.

## 9. Migration setup

```bash
cp .env.example .env   # fill DATABASE_URL etc.
npm run migration:run
npm run migration:generate -- database/migrations/MyChange  # after entity edits
npm run migration:revert
```

## 10. Telegram bot setup

1. Talk to @BotFather → `/newbot` → copy token → `TELEGRAM_BOT_TOKEN`.
2. Get your numeric user id via @userinfobot → `TELEGRAM_ALLOWED_USER_ID`.
3. Commands: `/start /learn /posts /linkedin /help /cancel`.

## 11. OpenRouter setup

1. https://openrouter.ai → API key → `OPENROUTER_API_KEY`.
2. `OPENROUTER_MODEL=openrouter/free` (default, free). Override per env.
3. `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1` (configurable).

## 12. LinkedIn developer setup (official API only)

> LinkedIn requirements change; verify at https://learn.microsoft.com/en-us/linkedin/.

1. https://developer.linkedin.com → Create app → verify.
2. Add product: **Share on LinkedIn** and/or **Sign In with LinkedIn using OpenID Connect**.
3. Request scopes: `openid profile email w_member_social`.
4. Set redirect: `http://localhost:3000/linkedin/oauth/callback` (and prod URL).
5. Copy Client ID/Secret → `LINKEDIN_CLIENT_ID/SECRET`.
6. Endpoints used: `oauth/v2/authorization`, `oauth/v2/accessToken`,
   `api.linkedin.com/v2/userinfo`, `api.linkedin.com/rest/posts` (header `LinkedIn-Version: 202501`).
7. If LinkedIn gates `w_member_social` behind app review, the app documents it,
   fails gracefully (`⚠️ ... reconnect`), and never uses scraping/workarounds.

### LinkedIn OAuth

```
GET /linkedin/oauth/start?userId=<uuid>  → { url }
GET /linkedin/oauth/callback?code&state  → links member, stores tokens
```

Telegram `/linkedin` sends the start URL. State is cryptographically random,
15-min TTL, single-use, bound to the user (see `oauth_states`).

## 13. Environment variables

See `.env.example`. Never commit `.env`.

## 14. Local development

```bash
npm install
cp .env.example .env
npm run migration:run
npm run start:dev
```

## 15. Docker

```bash
docker build -t linkedin-automation .
docker run --env-file .env -p 3000:3000 linkedin-automation
# local postgres:
docker compose up --build
```

Production uses Supabase; compose's postgres is dev-only.

## 16. Testing

```bash
npm test
npm run test:e2e
```

Unit tests mock Telegram/OpenRouter/LinkedIn — no real API calls.

## 17. Deployment

Set env vars on host, run migrations, then `node dist/main`. Behind HTTPS in
production so LinkedIn redirect URIs match.

## 18. Troubleshooting

| Symptom | Fix |
|---|---|
| `OPENROUTER_API_KEY is not configured` | set key in `.env` |
| Telegram `⛔ Unauthorized` | check `TELEGRAM_ALLOWED_USER_ID` matches your numeric id |
| DB SSL errors | keep `DATABASE_URL` pooler URL; `DB_SSL=true` |
| LinkedIn 403 on publish | app lacks `w_member_social` or member restricted; reconnect via `/linkedin` |
| Scheduler publishes twice | ensure single leader or rely on `pessimistic_write` claim |

## 19. Security

DTO validation, Telegram allow-list, post ownership checks, single-use OAuth
states, no tokens in logs/responses, throttling, safe error messages.

## 20. LinkedIn API limitations

- Text posts only in this version (no image/video upload endpoints wired).
- `w_member_social` requires app approval; personal/dev apps may be limited.
- Token expiry handled with 5-min margin + refresh when LinkedIn issues one.
- Rate limits → post marked `FAILED` with safe message; content preserved, retry via Telegram.
