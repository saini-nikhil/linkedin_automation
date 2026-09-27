import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3 add-on — Daily Tech Content tables + LinkedInPost metadata columns.
 * synchronize stays false; run with `npm run migration:run`.
 */
export class Phase3DailyContent1790544000000 implements MigrationInterface {
  name = 'Phase3DailyContent1790544000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "linkedin_posts" ADD "topic" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_posts" ADD "topicCategory" varchar(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_posts" ADD "approvedAt" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_posts" ADD "sourceUrls" text[] NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "linkedin_posts" ADD "rejectionReason" varchar(32)`,
    );

    await queryRunner.query(`
      CREATE TABLE "daily_content_generations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "postId" uuid REFERENCES "linkedin_posts"("id") ON DELETE SET NULL,
        "generationDate" varchar(10) NOT NULL,
        "topic" varchar(255),
        "category" varchar(64),
        "generationModel" varchar(255),
        "promptVersion" varchar(64),
        "sourceUrls" text[] NOT NULL DEFAULT '{}',
        "qualityScore" int,
        "regenerationCount" int NOT NULL DEFAULT 0,
        "status" varchar(32) NOT NULL DEFAULT 'DRAFT',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_daily_content_user_date" UNIQUE ("userId", "generationDate")
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_daily_content_user_date" ON "daily_content_generations" ("userId", "generationDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_daily_content_postId" ON "daily_content_generations" ("postId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "post_analytics" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "postId" uuid NOT NULL UNIQUE REFERENCES "linkedin_posts"("id") ON DELETE CASCADE,
        "impressions" int NOT NULL DEFAULT 0,
        "reactions" int NOT NULL DEFAULT 0,
        "comments" int NOT NULL DEFAULT 0,
        "reposts" int NOT NULL DEFAULT 0,
        "clicks" int NOT NULL DEFAULT 0,
        "capturedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_post_analytics_postId" ON "post_analytics" ("postId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "post_analytics"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "daily_content_generations"`);
    await queryRunner.query(`ALTER TABLE "linkedin_posts" DROP COLUMN IF EXISTS "rejectionReason"`);
    await queryRunner.query(`ALTER TABLE "linkedin_posts" DROP COLUMN IF EXISTS "sourceUrls"`);
    await queryRunner.query(`ALTER TABLE "linkedin_posts" DROP COLUMN IF EXISTS "approvedAt"`);
    await queryRunner.query(`ALTER TABLE "linkedin_posts" DROP COLUMN IF EXISTS "topicCategory"`);
    await queryRunner.query(`ALTER TABLE "linkedin_posts" DROP COLUMN IF EXISTS "topic"`);
  }
}
