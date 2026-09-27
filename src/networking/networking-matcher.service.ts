import { Injectable } from '@nestjs/common';
import { NetworkMatch } from './entities/network-match.entity';

/** Relevance labeling from professional criteria only. */
@Injectable()
export class NetworkingMatcherService {
  relevanceLabel(score: number): 'High' | 'Medium' | 'Low' {
    if (score >= 80) return 'High';
    if (score >= 60) return 'Medium';
    return 'Low';
  }

  describe(match: NetworkMatch): string {
    const lines = (match.reasons ?? []).map((r) => `✅ ${r}`);
    lines.push(`Relevance: ${match.matchScore}% (${this.relevanceLabel(match.matchScore)})`);
    return lines.join('\n');
  }
}
