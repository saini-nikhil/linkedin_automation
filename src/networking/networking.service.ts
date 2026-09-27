import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Person } from './entities/person.entity';
import { NetworkMatch } from './entities/network-match.entity';
import { JobMatch } from '../jobs/entities/job-match.entity';
import { CareerProfile } from '../career/entities/career-profile.entity';

/**
 * Networking discovery through permitted means only: opportunities are
 * derived from the user's matched hiring companies, with manual LinkedIn
 * search URLs. No profile scraping, no inference of personal attributes.
 */
@Injectable()
export class NetworkingService {
  private readonly logger = new Logger(NetworkingService.name);

  constructor(
    @InjectRepository(Person)
    private readonly persons: Repository<Person>,
    @InjectRepository(NetworkMatch)
    private readonly matches: Repository<NetworkMatch>,
  ) {}

  /** Build person stubs from matched companies. Deduplicated by search URL. */
  async discoverFromMatches(
    userId: string,
    profile: CareerProfile,
    matches: JobMatch[],
    scanId: string | null,
    limit: number,
  ): Promise<NetworkMatch[]> {
    const companies = new Map<string, JobMatch>();
    for (const m of matches) {
      const name = (m.job?.companyName ?? '').trim();
      if (!name || name.toLowerCase() === 'unknown') continue;
      if (!companies.has(name.toLowerCase())) companies.set(name.toLowerCase(), m);
    }
    const roleSeeds = (profile.targetRoles ?? []).slice(0, 3);
    const out: NetworkMatch[] = [];
    for (const m of companies.values()) {
      if (out.length >= limit) break;
      const company = m.job.companyName!.trim();
      const seedRole = roleSeeds[0] ?? 'Software Engineer';
      const keywords = encodeURIComponent(`${seedRole} ${company}`);
      const profileUrl = `https://www.linkedin.com/search/results/people/?keywords=${keywords}`;
      const externalId = createHash('sha256')
        .update(`linkedin-manual:${profileUrl.toLowerCase()}`)
        .digest('hex');
      let person = await this.persons.findOne({
        where: { source: 'linkedin-manual', externalId },
      });
      if (!person) {
        person = await this.persons.save(
          this.persons.create({
            source: 'linkedin-manual',
            externalId,
            name: null,
            headline: `${seedRole} candidates at ${company} (manual review)`,
            company,
            jobTitle: seedRole,
            profileUrl,
            skills: [...(profile.skills ?? [])].slice(0, 10),
            location: profile.location ?? null,
          }),
        );
      }
      const existing = await this.matches.findOne({
        where: { userId, personId: person.id },
      });
      if (existing) {
        existing.scanId = scanId;
        existing.person = person;
        out.push(await this.matches.save(existing));
        continue;
      }
      const reasons = [
        `Works at ${company} (matched hiring company)`,
        `Same technical area: ${(profile.skills ?? []).slice(0, 3).join(', ') || 'your stack'}`,
        `Role area: ${seedRole}`,
      ];
      const created_match = this.matches.create({
        userId,
        personId: person.id,
        scanId,
        matchScore: Math.min(95, (m.matchScore ?? 50) - 5),
        reasons,
      });
      created_match.person = person;
      out.push(await this.matches.save(created_match));
    }
    this.logger.log(`Networking: ${out.length} opportunities for user ${userId}`);
    return out;
  }

  async findMatchesForUser(
    userId: string,
    opts: { scanId?: string; limit?: number } = {},
  ): Promise<NetworkMatch[]> {
    const limit = Math.min(50, Math.max(1, opts.limit ?? 10));
    const qb = this.matches
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.person', 'person')
      .where('m.userId = :userId', { userId })
      .orderBy('m.matchScore', 'DESC')
      .take(limit);
    if (opts.scanId) qb.andWhere('m.scanId = :scanId', { scanId: opts.scanId });
    return qb.getMany();
  }
}
