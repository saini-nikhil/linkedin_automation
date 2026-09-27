import { Injectable, Logger } from '@nestjs/common';
import {
  DiscoveredJob,
  JobSearchCriteria,
  JobSourceProvider,
} from './job-source.provider';
import { RemoteOkProvider } from './sources/remoteok.provider';
import { ArbeitnowProvider } from './sources/arbeitnow.provider';
import { HnHiringProvider } from './sources/hn-hiring.provider';
import { ManualProvider } from './sources/manual.provider';

export interface SourceFanoutResult {
  jobs: DiscoveredJob[];
  /** Per-source job counts (source name -> discovered count). */
  perSource: Record<string, number>;
  /** Human-readable source failures for internal logs. */
  failures: string[];
}

/** Runs every provider; one source failing never breaks the scan. */
@Injectable()
export class JobSourceService {
  private readonly logger = new Logger(JobSourceService.name);
  private readonly providers: JobSourceProvider[];

  constructor(
    remoteok: RemoteOkProvider,
    arbeitnow: ArbeitnowProvider,
    hnHiring: HnHiringProvider,
    manual: ManualProvider,
  ) {
    this.providers = [remoteok, arbeitnow, hnHiring, manual];
  }

  async discoverAll(criteria: JobSearchCriteria): Promise<SourceFanoutResult> {
    const jobs: DiscoveredJob[] = [];
    const perSource: Record<string, number> = {};
    const failures: string[] = [];
    for (const provider of this.providers) {
      try {
        const found = await provider.getJobs(criteria);
        for (const job of found) {
          jobs.push({ ...job, source: provider.name });
        }
        perSource[provider.name] = found.length;
        this.logger.log(`[CareerScheduler] source ${provider.name}: ${found.length} jobs`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push(`${provider.name}: ${message}`);
        this.logger.warn(`[CareerScheduler] source ${provider.name} failed: ${message}`);
      }
    }
    return { jobs, perSource, failures };
  }
}
