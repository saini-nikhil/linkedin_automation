import { BadRequestException } from '@nestjs/common';

/** LinkedIn text-post limit (characters, Unicode-aware). */
export const LINKEDIN_MAX_CHARS = 3000;

/** Unicode-aware character count (emoji-safe: no blind string slicing). */
export function unicodeLength(text: string): number {
  return Array.from(text ?? '').length;
}

/**
 * Canonical plain-text sanitizer for LinkedIn post bodies.
 * - Normalizes CRLF/CR to LF.
 * - Removes null bytes and C0 control chars (keeps \n and \t).
 * - Preserves normal punctuation (. , ! ? : ; ' " - —), parentheses,
 *   brackets, braces, emojis, hashtags, Unicode text and line breaks.
 * - Collapses 3+ consecutive blank lines to a single blank line.
 * - Trims leading/trailing whitespace. Never truncates valid content.
 */
export function sanitizeLinkedInText(text: string): string {
  let out = text ?? '';
  out = out.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Strip null bytes and C0 controls, keeping \n and \t.
  out = out.replace(/[\0-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

/**
 * Validate canonical post text. Throws a clear application error instead
 * of silently cutting content. Call AFTER sanitizeLinkedInText().
 */
export function validateLinkedInText(text: string): void {
  if (!text || !text.trim()) {
    throw new BadRequestException(
      'LinkedIn post text is empty. Nothing to publish.',
    );
  }
  const len = unicodeLength(text);
  if (len > LINKEDIN_MAX_CHARS) {
    throw new BadRequestException(
      `LinkedIn post is ${len} characters, exceeding the supported limit of ${LINKEDIN_MAX_CHARS}. Shorten it instead of publishing a cut-off post.`,
    );
  }
}

/**
 * Escape text for the LinkedIn /rest/posts `commentary` wire format
 * ("little text format"). Reserved chars `\ | { } @ [ ] ( ) < > # * _ ~`
 * silently truncate the post at the first unescaped occurrence, so every
 * one of them is backslash-escaped. LinkedIn consumes the backslashes, so
 * `(JEV)` still displays as `(JEV)`.
 * URL spans (https?://…) are left intact so links keep working.
 */
export function escapeLinkedInCommentary(text: string): string {
  const urlPattern = /https?:\/\/\S+/g;
  const escapeSegment = (segment: string): string =>
    segment.replace(/[\\|{}@[\]()<>#*_~]/g, (ch) => `\\${ch}`);
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(text)) !== null) {
    result += escapeSegment(text.slice(lastIndex, match.index));
    result += match[0];
    lastIndex = match.index + match[0].length;
  }
  result += escapeSegment(text.slice(lastIndex));
  return result;
}

export interface LinkedInTextStats {
  chars: number;
  lines: number;
  first80: string;
  last80: string;
}

/** Publish-time stats. Safe to log: contains no tokens or secrets. */
export function getLinkedInTextStats(text: string): LinkedInTextStats {
  const chars = Array.from(text ?? '');
  return {
    chars: chars.length,
    lines: (text ?? '').split('\n').length,
    first80: chars.slice(0, 80).join(''),
    last80: chars.slice(-80).join(''),
  };
}
