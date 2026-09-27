import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  DiscoveredJob,
  JobSearchCriteria,
  JobSourceProvider,
} from '../job-source.provider';
import { cleanDescription, toValidDate } from '../utils/job-normalize.util';

/**
 * Hacker News "Who is hiring?" threads via the public Algolia API.
 * Best-effort: top-level comments of the latest hiring thread become
 * review candidates linking back to the HN comment (manual review).
 */
@Injectable()
export class HnHiringProvider implements JobSourceProvider {
  readonly name = 'hn-hiring';
  private readonly logger = new Logger(HnHiringProvider.name);

  constructor(private readonly http: HttpService) {}

  async getJobs(criteria: JobSearchCriteria): Promise<DiscoveredJob[]> {
    const search = await firstValueFrom(
      this.http.get('https://hn.algolia.com/api/v1/search', {
        params: {
          query: 'Who is hiring?',
          tags: 'story',
          hitsPerPage: 5,
        },
        timeout: 30000,
      }),
    );
    const hits: { objectID?: string; created_at?: string }[] =
      search?.data?.hits ?? [];
    // Latest hiring thread first.
    hits.sort((a, b) =>
      String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
    );
    const thread = hits[0];
    if (!thread?.objectID) return [];
    const item = await firstValueFrom(
      this.http.get(
        `https://hn.algolia.com/api/v1/items/${thread.objectID}`,
        { timeout: 30000 },
      ),
    );
    const comments: {
      id?: number;
      text?: string;
      created_at?: string;
    }[] = item?.data?.children ?? [];
    const out: DiscoveredJob[] = [];
    for (const comment of comments) {
      if (out.length >= criteria.limit || !comment?.text) continue;
      const clean = cleanDescription(comment.text) ?? '';
      const firstLine = clean.split('\n')[0].slice(0, 200) || 'HN hiring comment';
      out.push({
        externalId: `hn-${comment.id ?? out.length}`,
        title: firstLine,
        companyName: this.guessCompany(firstLine),
        jobUrl: comment.id
          ? `https://news.ycombinator.com/item?id=${comment.id}`
          : null,
        description: clean.slice(0, 4000),
        location: null,
        skills: [],
        postedAt: toValidDate(comment.created_at),
      });
    }
    this.logger.log(`HN hiring: ${out.length} comments from thread ${thread.objectID}`);
    return out;
  }

  private guessCompany(firstLine: string): string | null {
    const m = firstLine.match(/^(.{2,80}?)\s(?:—|–|\||-)\s/);
    return m ? m[1].trim() : null;
  }
}
