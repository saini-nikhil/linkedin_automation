import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterClient } from '../ai/openrouter.client';
import { CareerProfile } from '../career/entities/career-profile.entity';
import { Job } from './entities/job.entity';

export interface MatchBreakdown {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  roleMatch: boolean;
  experienceMatch: boolean;
  locationMatch: boolean;
  workTypeMatch: boolean;
  salaryMatch: boolean;
}

/**
 * Deterministic professional-criteria scoring (0-100, informational only).
 * AI is used solely to phrase the short explanation for top matches —
 * never to score, never to invent requirements.
 */
@Injectable()
export class JobMatcherService {
  private readonly logger = new Logger(JobMatcherService.name);

  constructor(private readonly openrouter: OpenRouterClient) {}

  score(profile: CareerProfile, job: Job): MatchBreakdown {
    const profileSkills = this.normList(profile.skills);
    const jobSkills = this.normList(job.skills);
    const haystack =
      `${job.title} ${job.description ?? ''} ${jobSkills.join(' ')}`.toLowerCase();
    const matchedSkills = profileSkills.filter(
      (s) => s && (haystack.includes(s) || jobSkills.includes(s)),
    );
    const missingSkills = jobSkills
      .filter((s) => s && !profileSkills.includes(s))
      .slice(0, 5);

    // Skills (40): overlap ratio; neutral 20 when the job lists no signals.
    const skillSignals = new Set([...jobSkills, ...matchedSkills]).size;
    const skillScore =
      skillSignals === 0
        ? 20
        : Math.round((matchedSkills.length / skillSignals) * 40);

    // Role (25): full target-role phrase in title, else any word overlap.
    const title = job.title.toLowerCase();
    const roles = this.normList(profile.targetRoles);
    const fullRole = roles.some((r) => r && title.includes(r));
    const partialRole =
      !fullRole &&
      roles.some((r) =>
        r.split(/\s+/).some((w) => w.length > 3 && title.includes(w)),
      );
    const roleMatch = fullRole;
    const roleScore = fullRole ? 25 : partialRole ? 12 : 0;

    // Location (15).
    const loc = this.locationScore(profile.location, job.location);

    // Work type (10).
    const wt = this.workTypeScore(profile.workTypes, job.workType);

    // Experience (10): parse "X years" requirements from description.
    const exp = this.experienceScore(
      profile.experienceYears,
      job.description,
    );

    // Salary overlap (10).
    const sal = this.salaryScore(
      profile.salaryMin,
      profile.salaryMax,
      job.salaryMin,
      job.salaryMax,
    );

    const score = Math.max(
      0,
      Math.min(
        100,
        skillScore +
          roleScore +
          loc.score +
          wt.score +
          exp.score +
          sal.score,
      ),
    );
    return {
      score,
      matchedSkills: [...new Set(matchedSkills)].slice(0, 10),
      missingSkills,
      roleMatch,
      experienceMatch: exp.match,
      locationMatch: loc.match,
      workTypeMatch: wt.match,
      salaryMatch: sal.match,
    };
  }

  /** Template explanation built only from computed sets — never fabricated. */
  templateExplanation(
    breakdown: MatchBreakdown,
    profile: CareerProfile,
    job: Job,
  ): string {
    const lines: string[] = [];
    if (breakdown.matchedSkills.length > 0) {
      lines.push(`✅ ${breakdown.matchedSkills.join(', ')}`);
    }
    if (breakdown.roleMatch) lines.push(`✅ ${job.title} role`);
    if (breakdown.locationMatch)
      lines.push(`✅ ${job.location ?? 'Location fit'}`);
    if (breakdown.workTypeMatch)
      lines.push(`✅ ${job.workType ?? 'Work-type fit'}`);
    if (breakdown.salaryMatch) lines.push(`✅ Salary overlap`);
    if (breakdown.experienceMatch) lines.push(`✅ Experience fit`);
    if (breakdown.missingSkills.length > 0) {
      lines.push(`⚠️ Gap: ${breakdown.missingSkills.join(', ')}`);
    }
    if (lines.length === 0) {
      lines.push(
        `ℹ️ Partial match against ${profile.targetRoles[0] ?? 'your target roles'}. Review details before acting.`,
      );
    }
    return lines.join('\n');
  }

  /** AI-polished explanation for top matches; template fallback on failure. */
  async explain(
    breakdown: MatchBreakdown,
    profile: CareerProfile,
    job: Job,
  ): Promise<string> {
    const fallback = this.templateExplanation(breakdown, profile, job);
    try {
      const text = await this.openrouter.chat([
        {
          role: 'system',
          content:
            'You write 3-5 short lines explaining a job match to a developer. ' +
            'Use ONLY the facts provided. Never invent skills, salary, companies, ' +
            'or requirements. Mark matches with ✅ and gaps with ⚠️. Plain text only.',
        },
        {
          role: 'user',
          content:
            `Job: ${job.title} at ${job.companyName ?? 'Unknown company'}\n` +
            `Location: ${job.location ?? 'unknown'}, Work type: ${job.workType ?? 'unknown'}\n` +
            `Matched skills: ${breakdown.matchedSkills.join(', ') || 'none'}\n` +
            `Missing skills: ${breakdown.missingSkills.join(', ') || 'none'}\n` +
            `Role match: ${breakdown.roleMatch}, Experience fit: ${breakdown.experienceMatch}, ` +
            `Location fit: ${breakdown.locationMatch}, Work-type fit: ${breakdown.workTypeMatch}, ` +
            `Salary overlap: ${breakdown.salaryMatch}\n` +
            `Score: ${breakdown.score}/100 (informational only).`,
        },
      ]);
      return text.trim().slice(0, 800);
    } catch (err) {
      this.logger.warn(
        `Match explanation AI failed, using template: ${err instanceof Error ? err.message : String(err)}`,
      );
      return fallback;
    }
  }

  private normList(values: string[] | null | undefined): string[] {
    return (values ?? []).map((v) => v.trim().toLowerCase()).filter(Boolean);
  }

  private locationScore(
    profileLoc: string | null | undefined,
    jobLoc: string | null | undefined,
  ): { score: number; match: boolean } {
    const p = (profileLoc ?? '').trim().toLowerCase();
    const j = (jobLoc ?? '').trim().toLowerCase();
    if (!p || !j) return { score: 8, match: false };
    if (j.includes('remote') && (p.includes('remote') || p.includes('anywhere')))
      return { score: 15, match: true };
    if (p.includes(j) || j.includes(p)) return { score: 15, match: true };
    return { score: 0, match: false };
  }

  private workTypeScore(
    profileTypes: string[] | null | undefined,
    jobType: string | null | undefined,
  ): { score: number; match: boolean } {
    const mine = this.normList(profileTypes);
    const j = (jobType ?? '').trim().toLowerCase();
    if (mine.length === 0 || !j) return { score: 5, match: false };
    const hit = mine.some((t) => j.includes(t) || t.includes(j));
    return hit ? { score: 10, match: true } : { score: 0, match: false };
  }

  private experienceScore(
    profileYears: number | null | undefined,
    description: string | null | undefined,
  ): { score: number; match: boolean } {
    if (profileYears === null || profileYears === undefined)
      return { score: 5, match: false };
    const m = (description ?? '')
      .toLowerCase()
      .match(/(\d+)\s*\+?\s*(years?|yrs?)/);
    if (!m) return { score: 7, match: false };
    const required = parseInt(m[1], 10);
    return required <= profileYears + 1
      ? { score: 10, match: true }
      : { score: 2, match: false };
  }

  private salaryScore(
    pMin: number | null | undefined,
    pMax: number | null | undefined,
    jMin: number | null | undefined,
    jMax: number | null | undefined,
  ): { score: number; match: boolean } {
    if (pMin == null || jMin == null || jMax == null)
      return { score: 5, match: false };
    const pHi = pMax ?? Number.MAX_SAFE_INTEGER;
    const overlap = Math.max(pMin, jMin) <= Math.min(pHi, jMax);
    return overlap ? { score: 10, match: true } : { score: 2, match: false };
  }
}
