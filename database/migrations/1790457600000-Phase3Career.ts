import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3 — Daily Career Assistant tables.
 * synchronize stays false; run with `npm run migration:run`.
 */
export class Phase3Career1790457600000 implements MigrationInterface {
  name = 'Phase3Career1790457600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "career_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
        "targetRoles" text[] NOT NULL DEFAULT '{}',
        "skills" text[] NOT NULL DEFAULT '{}',
        "experienceYears" int,
        "location" varchar(255),
        "workTypes" text[] NOT NULL DEFAULT '{}',
        "salaryMin" int,
        "salaryMax" int,
        "currency" varchar(8) NOT NULL DEFAULT 'INR',
        "noticePeriodDays" int,
        "employmentTypes" text[] NOT NULL DEFAULT '{}',
        "targetCompanies" text[] NOT NULL DEFAULT '{}',
        "excludedCompanies" text[] NOT NULL DEFAULT '{}',
        "jobSourceUrls" text[] NOT NULL DEFAULT '{}',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_career_profiles_userId" ON "career_profiles" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "career_scans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "scanDate" varchar(10) NOT NULL,
        "startedAt" timestamptz NOT NULL DEFAULT now(),
        "completedAt" timestamptz,
        "jobsDiscovered" int NOT NULL DEFAULT 0,
        "duplicatesRemoved" int NOT NULL DEFAULT 0,
        "jobsMatched" int NOT NULL DEFAULT 0,
        "networkingMatches" int NOT NULL DEFAULT 0,
        "status" varchar(16) NOT NULL DEFAULT 'RUNNING',
        "errorMessage" text,
        "reportText" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_career_scans_user_scanDate" UNIQUE ("userId", "scanDate")
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_career_scans_userId" ON "career_scans" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_career_scans_user_scanDate" ON "career_scans" ("userId", "scanDate")`,
    );

    await queryRunner.query(`
      CREATE TABLE "jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "source" varchar(64) NOT NULL,
        "externalId" varchar(512) NOT NULL,
        "title" varchar(500) NOT NULL,
        "companyName" varchar(255),
        "companyUrl" text,
        "jobUrl" text,
        "description" text,
        "location" varchar(255),
        "workType" varchar(32),
        "employmentType" varchar(32),
        "salaryMin" int,
        "salaryMax" int,
        "currency" varchar(8),
        "skills" text[] NOT NULL DEFAULT '{}',
        "postedAt" timestamptz,
        "firstSeenAt" timestamptz NOT NULL DEFAULT now(),
        "lastSeenAt" timestamptz NOT NULL DEFAULT now(),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_jobs_source_external" UNIQUE ("source", "externalId")
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_source" ON "jobs" ("source")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_jobs_source_external" ON "jobs" ("source", "externalId")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_jobs_jobUrl" ON "jobs" ("jobUrl")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_postedAt" ON "jobs" ("postedAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_createdAt" ON "jobs" ("createdAt")`);

    await queryRunner.query(`
      CREATE TABLE "job_matches" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "jobId" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
        "scanId" uuid REFERENCES "career_scans"("id") ON DELETE SET NULL,
        "matchScore" int NOT NULL DEFAULT 0,
        "matchedSkills" text[] NOT NULL DEFAULT '{}',
        "missingSkills" text[] NOT NULL DEFAULT '{}',
        "roleMatch" boolean NOT NULL DEFAULT false,
        "experienceMatch" boolean NOT NULL DEFAULT false,
        "locationMatch" boolean NOT NULL DEFAULT false,
        "workTypeMatch" boolean NOT NULL DEFAULT false,
        "salaryMatch" boolean NOT NULL DEFAULT false,
        "explanation" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_job_matches_user_job" UNIQUE ("userId", "jobId")
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_job_matches_userId" ON "job_matches" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_job_matches_jobId" ON "job_matches" ("jobId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_job_matches_user_job" ON "job_matches" ("userId", "jobId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "applications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "jobId" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
        "status" varchar(16) NOT NULL DEFAULT 'SAVED',
        "appliedAt" timestamptz,
        "applicationUrl" text,
        "resumeVersion" varchar(64),
        "coverLetter" text,
        "notes" text,
        "lastFollowUpAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_applications_user_job" UNIQUE ("userId", "jobId")
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_applications_userId" ON "applications" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_applications_status" ON "applications" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "persons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "source" varchar(64) NOT NULL,
        "externalId" varchar(512) NOT NULL,
        "name" varchar(255),
        "headline" varchar(500),
        "company" varchar(255),
        "jobTitle" varchar(255),
        "profileUrl" text,
        "skills" text[] NOT NULL DEFAULT '{}',
        "location" varchar(255),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_persons_source_external" UNIQUE ("source", "externalId")
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_persons_source_external" ON "persons" ("source", "externalId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "network_matches" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "personId" uuid NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
        "scanId" uuid REFERENCES "career_scans"("id") ON DELETE SET NULL,
        "matchScore" int NOT NULL DEFAULT 0,
        "reasons" text[] NOT NULL DEFAULT '{}',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_network_matches_user_person" UNIQUE ("userId", "personId")
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_network_matches_userId" ON "network_matches" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_network_matches_user_person" ON "network_matches" ("userId", "personId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "connection_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "personId" uuid NOT NULL REFERENCES "persons"("id") ON DELETE CASCADE,
        "message" text NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'DRAFT',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_connection_messages_user_person" ON "connection_messages" ("userId", "personId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "connection_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "network_matches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "persons"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "applications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "job_matches"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "career_scans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "career_profiles"`);
  }
}
