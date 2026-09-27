export interface JobSearchCriteria {
  keywords: string[];
  skills: string[];
  location?: string | null;
  limit: number;
  /** Curated career-page URLs (manual-review provider). */
  sourceUrls?: string[];
}

export interface DiscoveredJob {
  /** Set by JobSourceService fan-out (provider name). */
  source?: string;
  externalId: string;
  title: string;
  companyName?: string | null;
  companyUrl?: string | null;
  jobUrl?: string | null;
  description?: string | null;
  location?: string | null;
  /** REMOTE | HYBRID | ONSITE */
  workType?: string | null;
  employmentType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  skills?: string[];
  postedAt?: Date | null;
}

/**
 * One permitted job source. Implementations must only use official APIs or
 * feeds whose terms allow automated access. No scraping, no auth bypass.
 */
export interface JobSourceProvider {
  readonly name: string;
  getJobs(criteria: JobSearchCriteria): Promise<DiscoveredJob[]>;
}
