import { Injectable } from '@nestjs/common';
import { unicodeLength } from '../linkedin/utils/linkedin-text.util';

export interface QualityResult {
  pass: boolean;
  /** 0-100 heuristic score (usefulness signal, not a guarantee). */
  score: number;
  failures: string[];
}

const MAX_HASHTAGS = 5;
const MAX_EMOJIS = 8;
const MIN_CHARS = 80;
const MAX_CHARS = 2600;

const LABEL_HEADER = /^(title|heading|topic|post|content|summary)\s*:/im;
const CODE_FENCE = /```/;
const JSON_SHAPE = /^\s*[\[{]\s*"/;
const META_COMMENTARY =
  /^(here is|here's|sure,|certainly|as an ai|i've written|below is)/i;
const CLICKBAIT =
  /(you won't believe|shocking|mind-blowing|secret (trick|hack)|guaranteed|100% (free|success)|act now|limited time)/i;
const ENGAGEMENT_BAIT =
  /(agree\?|what do you think\?|like and share|follow me for more|comment yes!)/i;
/** Digits-as-proof near claim words: likely invented statistics. */
const SUSPECT_STAT =
  /(\d+(\.\d+)?\s?%|\d+x\b).{0,60}(study|studies|research|developers|companies|teams|survey)/i;

const EMOJI_PATTERN =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;

/**
 * Pre-publish quality gate for daily tech posts. Heuristic tripwires only —
 * failures trigger one automatic regeneration, then a ⚠️ notice instead of
 * publishing low-quality content.
 */
@Injectable()
export class PostQualityService {
  check(content: string, recentTopics: string[] = []): QualityResult {
    const failures: string[] = [];
    const text = content ?? '';
    const len = unicodeLength(text);
    if (!text.trim()) failures.push('empty content');
    if (len > 0 && len < MIN_CHARS) failures.push('too short');
    if (len > MAX_CHARS) failures.push('too long');

    const hashtags = (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
    if (hashtags > MAX_HASHTAGS) failures.push('excessive hashtags');
    const emojis = (text.match(EMOJI_PATTERN) ?? []).length;
    if (emojis > MAX_EMOJIS) failures.push('excessive emojis');

    const firstLine = text.split('\n')[0] ?? '';
    if (LABEL_HEADER.test(firstLine) || LABEL_HEADER.test(text.slice(0, 120))) {
      failures.push('title/heading at beginning');
    }
    if (CODE_FENCE.test(text)) failures.push('markdown code fences');
    if (JSON_SHAPE.test(text)) failures.push('JSON output');
    if (META_COMMENTARY.test(text.trim())) failures.push('AI meta-commentary');
    if (CLICKBAIT.test(text)) failures.push('clickbait');
    if (ENGAGEMENT_BAIT.test(text)) failures.push('fake engagement bait');
    if (SUSPECT_STAT.test(text)) failures.push('unsupported statistics');

    const norm = text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (
      norm &&
      recentTopics.some((t) => {
        const nt = t.toLowerCase().replace(/\s+/g, ' ').trim();
        return nt.length > 12 && norm.includes(nt);
      })
    ) {
      failures.push('duplicate topic');
    }

    const score = Math.max(0, 100 - failures.length * 20);
    return { pass: failures.length === 0, score, failures };
  }
}
