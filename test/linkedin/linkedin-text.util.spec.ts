import { BadRequestException } from '@nestjs/common';
import {
  LINKEDIN_MAX_CHARS,
  escapeLinkedInCommentary,
  getLinkedInTextStats,
  sanitizeLinkedInText,
  unicodeLength,
  validateLinkedInText,
} from '../../src/linkedin/utils/linkedin-text.util';

describe('linkedin-text.util', () => {
  describe('sanitizeLinkedInText', () => {
    it('1. leaves plain text untouched', () => {
      expect(sanitizeLinkedInText('Today I learned about Redis caching.')).toBe(
        'Today I learned about Redis caching.',
      );
    });

    it('2. preserves parentheses content whole', () => {
      const text =
        'Today I learned about Redis caching (TTL and eviction policies).';
      expect(sanitizeLinkedInText(text)).toBe(text);
    });

    it('3. preserves brackets content whole', () => {
      const text = 'I learned about arrays [map, filter, reduce].';
      expect(sanitizeLinkedInText(text)).toBe(text);
    });

    it('4. preserves curly braces content whole', () => {
      const text = 'I explored JavaScript objects {key: value}.';
      expect(sanitizeLinkedInText(text)).toBe(text);
    });

    it('5. preserves emoji', () => {
      const text = 'Today I learned about Redis 🚀';
      expect(sanitizeLinkedInText(text)).toBe(text);
      expect(unicodeLength(text)).toBe(Array.from(text).length);
    });

    it('6. preserves hashtags', () => {
      const text = 'Today I learned about caching.\n\n#Redis #Backend';
      expect(sanitizeLinkedInText(text)).toBe(text);
    });

    it('7. preserves all paragraphs of a multiline post', () => {
      const text = 'paragraph 1\n\nparagraph 2\n\nparagraph 3';
      expect(sanitizeLinkedInText(text)).toBe(text);
    });

    it('8. does NOT split a title-like first line away from the body', () => {
      const text =
        'Reducing token usage in large language models\n\nToday I learned...';
      // Whole-body treatment: first line stays part of the post.
      expect(sanitizeLinkedInText(text)).toBe(text);
    });

    it('normalizes CRLF to LF and collapses excessive blank lines', () => {
      expect(sanitizeLinkedInText('a\r\n\r\n\r\nb')).toBe('a\n\nb');
      expect(sanitizeLinkedInText('a\r\rb')).toBe('a\n\nb');
    });

    it('removes null/control characters but keeps newlines and tabs', () => {
      expect(sanitizeLinkedInText('a\0b\x01c\nd\te')).toBe('abc\nd\te');
    });

    it('trims leading/trailing whitespace without touching valid content', () => {
      expect(sanitizeLinkedInText('  hello\n\nworld  ')).toBe('hello\n\nworld');
    });
  });

  describe('validateLinkedInText', () => {
    it('9. rejects empty AI responses with a clear error', () => {
      expect(() => validateLinkedInText('')).toThrow(BadRequestException);
      expect(() => validateLinkedInText('   \n  ')).toThrow(
        BadRequestException,
      );
    });

    it('10. rejects oversized posts instead of silently truncating', () => {
      expect(() => validateLinkedInText('a'.repeat(LINKEDIN_MAX_CHARS + 1))).toThrow(
        /exceeding the supported limit/,
      );
    });

    it('accepts posts at exactly the limit, emoji-safe', () => {
      // 2999 ascii + 1 emoji = 3000 unicode chars (not UTF-16 units).
      const text = `${'a'.repeat(LINKEDIN_MAX_CHARS - 1)}🚀`;
      expect(unicodeLength(text)).toBe(LINKEDIN_MAX_CHARS);
      expect(() => validateLinkedInText(text)).not.toThrow();
    });
  });

  describe('escapeLinkedInCommentary', () => {
    it('escapes little-text reserved characters that truncate posts', () => {
      expect(escapeLinkedInCommentary('caching (TTL)')).toBe('caching \\(TTL\\)');
      expect(escapeLinkedInCommentary('arrays [map]')).toBe('arrays \\[map\\]');
      expect(escapeLinkedInCommentary('objects {key}')).toBe('objects \\{key\\}');
      expect(escapeLinkedInCommentary('a **bold** move')).toBe(
        'a \\*\\*bold\\*\\* move',
      );
      expect(escapeLinkedInCommentary('#Redis #Backend')).toBe(
        '\\#Redis \\#Backend',
      );
    });

    it('escapes backslashes first to avoid double-escaping', () => {
      expect(escapeLinkedInCommentary('a\\(b')).toBe('a\\\\\\(b');
    });

    it('leaves URLs intact so links keep working', () => {
      const text = 'see https://en.wikipedia.org/wiki/Cache_(computing) now';
      expect(escapeLinkedInCommentary(text)).toBe(text);
    });

    it('leaves normal punctuation, emojis and newlines alone', () => {
      const text = "It's great: fast, cheap — wow! 🚀\nNew line.";
      expect(escapeLinkedInCommentary(text)).toBe(text);
    });
  });

  describe('getLinkedInTextStats', () => {
    it('reports unicode-aware chars, lines, head and tail', () => {
      const stats = getLinkedInTextStats('ab\ncd🚀');
      expect(stats.chars).toBe(6);
      expect(stats.lines).toBe(2);
      expect(stats.first80).toBe('ab\ncd🚀');
      expect(stats.last80).toBe('ab\ncd🚀');
    });
  });
});
