import { createHash } from 'crypto';

/** Lowercase host, drop fragment/trailing slash for stable identity. */
export function normalizeJobUrl(raw: string): string {
  let url = (raw ?? '').trim();
  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) url = url.slice(0, hashIndex);
  url = url.replace(/\/+$/, '');
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return url.toLowerCase();
  }
}

export function hashJobIdentity(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Strip HTML tags and collapse whitespace from provider descriptions. */
export function cleanDescription(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

export function toIntOrNull(
  value: unknown,
): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses a provider date, returning null for anything missing or
 * unparseable. Never returns an Invalid Date — those serialize as
 * NaN-NaN-... and crash timestamptz columns.
 */
export function toValidDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date =
    value instanceof Date ? value : new Date(String(value).trim());
  return Number.isNaN(date.getTime()) ? null : date;
}
