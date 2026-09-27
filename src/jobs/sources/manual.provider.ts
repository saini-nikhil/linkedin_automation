import { Injectable, Logger } from '@nestjs/common';
import {
  DiscoveredJob,
  JobSearchCriteria,
  JobSourceProvider,
} from '../job-source.provider';
import {
  hashJobIdentity,
  normalizeJobUrl,
} from '../utils/job-normalize.util';

/**
 * Curated career-page URLs from the user's profile. No fetching, no
 * scraping — stores the official URL as a manual-review candidate.
 */
@Injectable()
export class ManualProvider implements JobSourceProvider {
  readonly name = 'manual';
  private readonly logger = new Logger(ManualProvider.name);

  async getJobs(criteria: JobSearchCriteria): Promise<DiscoveredJob[]> {
    const urls = (criteria.sourceUrls ?? []).map((u) => u.trim()).filter(Boolean);
    const out: DiscoveredJob[] = urls.slice(0, criteria.limit).map((raw) => {
      const normalized = normalizeJobUrl(raw);
      let company: string | null = null;
      try {
        company = new URL(normalized).hostname.replace(/^www\./, '');
      } catch {
        company = null;
      }
      return {
        externalId: hashJobIdentity(`manual:${normalized}`),
        title: 'Manual review',
        companyName: company,
        jobUrl: raw.trim(),
        description:
          'Saved from your curated career pages. Open the official URL to review and apply manually.',
        skills: [],
      };
    });
    this.logger.log(`Manual: ${out.length} curated URLs`);
    return out;
  }
}
