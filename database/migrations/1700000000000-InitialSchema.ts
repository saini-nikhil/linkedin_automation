import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "telegramId" varchar(32) NOT NULL UNIQUE,
        "telegramUsername" varchar(255),
        "linkedinMemberId" varchar(255),
        "linkedinAccessToken" text,
        "linkedinRefreshToken" text,
        "linkedinTokenExpiresAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_users_telegramId" ON "users" ("telegramId")`);

    await queryRunner.query(`
      CREATE TABLE "learning_notes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "content" text NOT NULL,
        "topic" varchar(255),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_learning_notes_userId" ON "learning_notes" ("userId")`);

    await queryRunner.query(`
      CREATE TABLE "linkedin_posts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "learningNoteId" uuid REFERENCES "learning_notes"("id") ON DELETE SET NULL,
        "content" text NOT NULL,
        "style" varchar(64) NOT NULL DEFAULT 'SOMETHING_I_LEARNED',
        "status" varchar(32) NOT NULL DEFAULT 'DRAFT',
        "scheduledAt" timestamptz,
        "publishedAt" timestamptz,
        "linkedinPostId" varchar(255),
        "generationModel" varchar(255),
        "promptVersion" varchar(64),
        "errorMessage" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_linkedin_posts_userId" ON "linkedin_posts" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_linkedin_posts_status" ON "linkedin_posts" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_linkedin_posts_scheduledAt" ON "linkedin_posts" ("scheduledAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_linkedin_posts_user_status" ON "linkedin_posts" ("userId", "status")`);

    await queryRunner.query(`
      CREATE TABLE "post_edits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "postId" uuid NOT NULL REFERENCES "linkedin_posts"("id") ON DELETE CASCADE,
        "oldContent" text NOT NULL,
        "newContent" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_post_edits_postId" ON "post_edits" ("postId")`);

    await queryRunner.query(`
      CREATE TABLE "oauth_states" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "state" text NOT NULL UNIQUE,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_oauth_states_state" ON "oauth_states" ("state")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "oauth_states"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "post_edits"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "linkedin_posts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "learning_notes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
