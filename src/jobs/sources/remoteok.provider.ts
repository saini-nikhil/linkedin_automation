import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  DiscoveredJob,
  JobSearchCriteria,
  JobSourceProvider,
} from '../job-source.provider';
import { cleanDescription, toIntOrNull, toValidDate } from '../utils/job-normalize.util';

/** RemoteOK public API (no key). Filters client-side by profile keywords. */
@Injectable()
export class RemoteOkProvider implements JobSourceProvider {
  readonly name = 'remoteok';
  private readonly logger = new Logger(RemoteOkProvider.name);

  constructor(private readonly http: HttpService) {}

  async getJobs(criteria: JobSearchCriteria): Promise<DiscoveredJob[]> {
    const res = await firstValueFrom(
      this.http.get('https://remoteok.com/api', {
        headers: { 'User-Agent': 'linkedin-learning-automation/1.0' },
        timeout: 30000,
      }),
    );
    const items: Record<string, unknown>[] = Array.isArray(res.data)
      ? res.data
      : [];
    const keywords = criteria.keywords
      .concat(criteria.skills)
      .map((k) => k.toLowerCase())
      .filter(Boolean);
    const out: DiscoveredJob[] = [];
    for (const item of items) {
      if (typeof item.id === 'undefined' || out.length >= criteria.limit) {
        continue;
      }
      const title = String(item.position ?? '');
      const tags = Array.isArray(item.tags)
        ? (item.tags as unknown[]).map((t) => String(t))
        : [];
      const haystack = `${title} ${tags.join(' ')}`.toLowerCase();
      if (
        keywords.length > 0 &&
        !keywords.some((k) => haystack.includes(k))
      ) {
        continue;
      }
      const slug = typeof item.slug === 'string' ? item.slug : null;
      out.push({
        externalId: String(item.id),
        title: title || 'Untitled role',
        companyName:
          typeof item.company === 'string' ? item.company : null,
        jobUrl:
          typeof item.url === 'string'
            ? item.url
            : slug
              ? `https://remoteok.com/remote-jobs/${slug}`
              : null,
        description: cleanDescription(
          typeof item.description === 'string' ? item.description : null,
        ),
        location:
          typeof item.location === 'string' && item.location
            ? item.location
            : 'Remote',
        workType: 'REMOTE',
        employmentType: null,
        salaryMin: toIntOrNull(item.salary_min),
        salaryMax: toIntOrNull(item.salary_max),
        currency: 'USD',
        skills: tags,
        postedAt: toValidDate(item.date),
      });
    }
    this.logger.log(`RemoteOK: ${out.length} jobs after keyword filter`);
    return out;
  }
}
