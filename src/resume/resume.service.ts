import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterClient } from '../ai/openrouter.client';
import { CareerProfile } from '../career/entities/career-profile.entity';
import { Job } from '../jobs/entities/job.entity';

const RESUME_SYSTEM = `You help a developer tailor their resume for a specific job.
Use ONLY the skills, roles, and experience in the provided profile.
NEVER invent experience, employment, projects, technologies,
certifications, achievements, metrics, or job titles.
If information is missing, say it is unknown. Do not guess.
Suggest: resume summary, relevant skills, project ordering,
experience-bullet improvements, keywords, ATS-friendly wording.
Plain text only, concise.`;

/**
 * Resume/cover-letter assistance grounded strictly in the career profile.
 * Generates suggestions and drafts — never claims, never submits.
 */
@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  constructor(private readonly openrouter: OpenRouterClient) {}

  private profileContext(profile: CareerProfile): string {
    return (
      `Target roles: ${(profile.targetRoles ?? []).join(', ') || 'unknown'}\n` +
      `Skills: ${(profile.skills ?? []).join(', ') || 'unknown'}\n` +
      `Experience: ${profile.experienceYears ?? 'unknown'} years\n` +
      `Location: ${profile.location ?? 'unknown'}\n` +
      `Work type: ${(profile.workTypes ?? []).join(', ') || 'unknown'}`
    );
  }

  async suggestResume(
    profile: CareerProfile,
    job: Job | null,
    focus?: string,
  ): Promise<string> {
    const jobBlock = job
      ? `Job: ${job.title} at ${job.companyName ?? 'unknown'}\n` +
        `Description: ${(job.description ?? 'unknown').slice(0, 2000)}\n`
      : 'No specific job selected. Give general tailoring advice.\n';
    try {
      const text = await this.openrouter.chat([
        { role: 'system', content: RESUME_SYSTEM },
        {
          role: 'user',
          content:
            `Candidate profile:\n${this.profileContext(profile)}\n\n` +
            jobBlock +
            (focus ? `\nFocus on: ${focus}\n` : ''),
        },
      ]);
      return text.trim().slice(0, 3000);
    } catch (err) {
      this.logger.warn(
        `Resume suggestions failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new Error(
        'Resume assistance is unavailable right now (AI service failed). No content was generated.',
      );
    }
  }

  async generateCoverLetter(
    profile: CareerProfile,
    job: Job,
    userName?: string,
  ): Promise<string> {
    const system =
      'You write a short personalized cover letter. Use ONLY the candidate ' +
      'profile and job description provided. Never invent relationships with ' +
      'the company, admiration, experience, or achievements. If something is ' +
      'unknown, omit it. Plain text only.';
    try {
      const text = await this.openrouter.chat([
        { role: 'system', content: system },
        {
          role: 'user',
          content:
            `Candidate (name: ${userName ?? 'the candidate'}):\n` +
            `${this.profileContext(profile)}\n\n` +
            `Job: ${job.title} at ${job.companyName ?? 'unknown'}\n` +
            `Description: ${(job.description ?? 'unknown').slice(0, 2000)}`,
        },
      ]);
      return text.trim().slice(0, 3000);
    } catch (err) {
      this.logger.warn(
        `Cover letter failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new Error(
        'Cover-letter generation is unavailable right now (AI service failed). No content was generated.',
      );
    }
  }
}
