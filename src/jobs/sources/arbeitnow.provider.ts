import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  DiscoveredJob,
  JobSearchCriteria,
  JobSourceProvider,
} from '../job-source.provider';
import { cleanDescription, toValidDate } from '../utils/job-normalize.util';

/** Arbeitnow public job-board API (no key). */
@Injectable()
export class ArbeitnowProvider implements JobSourceProvider {
  readonly name = 'arbeitnow';
  private readonly logger = new Logger(ArbeitnowProvider.name);

  constructor(private readonly http: HttpService) {}

  async getJobs(criteria: JobSearchCriteria): Promise<DiscoveredJob[]> {
    const res = await firstValueFrom(
      this.http.get('https://www.arbeitnow.com/api/job-board-api', {
        timeout: 30000,
      }),
    );
    const items: Record<string, unknown>[] = Array.isArray(res?.data?.data)
      ? res.data.data
      : [];
    const keywords = criteria.keywords
      .concat(criteria.skills)
      .map((k) => k.toLowerCase())
      .filter(Boolean);
    const out: DiscoveredJob[] = [];
    for (const item of items) {
      if (out.length >= criteria.limit) break;
      const title = String(item.title ?? '');
      const haystack = `${title} ${String(item.tags ?? '')}`.toLowerCase();
      if (
        keywords.length > 0 &&
        !keywords.some((k) => haystack.includes(k))
      ) {
        continue;
      }
      const remote = item.remote === true;
      out.push({
        externalId: String(item.slug ?? item.title ?? out.length),
        title: title || 'Untitled role',
        companyName:
          typeof item.company_name === 'string' ? item.company_name : null,
        jobUrl: typeof item.url === 'string' ? item.url : null,
        description: cleanDescription(
          typeof item.description === 'string' ? item.description : null,
        ),
        location:
          typeof item.location === 'string' && item.location
            ? item.location
            : remote
              ? 'Remote'
              : null,
        workType: remote ? 'REMOTE' : null,
        employmentType:
          Array.isArray(item.job_types) && item.job_types.length > 0
            ? String(item.job_types[0])
            : null,
        skills: [],
        postedAt: toValidDate(item.created_at),
      });
    }
    this.logger.log(`Arbeitnow: ${out.length} jobs after keyword filter`);
    return out;
  }
}
