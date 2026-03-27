import { PEOPLE_TAG_OPTIONS } from '@/types';

export const MAX_PEOPLE_TAG_LENGTH = 80;

/** Trim, collapse spaces, enforce max length. Empty input → null. */
export function normalizePeopleTag(value: unknown): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim().replace(/\s+/g, ' ');
  if (!s) return null;
  if (s.length > MAX_PEOPLE_TAG_LENGTH) return null;
  return s;
}

/**
 * Sort: preset options in listed order, then other tags A–Z, then unassigned.
 */
export function comparePeopleTags(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const norm = (t: string | null | undefined) => (t == null || String(t).trim() === '' ? null : String(t).trim());
  const na = norm(a);
  const nb = norm(b);
  if (na === null && nb === null) return 0;
  if (na === null) return 1;
  if (nb === null) return -1;

  const ia = PEOPLE_TAG_OPTIONS.indexOf(na as (typeof PEOPLE_TAG_OPTIONS)[number]);
  const ib = PEOPLE_TAG_OPTIONS.indexOf(nb as (typeof PEOPLE_TAG_OPTIONS)[number]);
  const aPreset = ia >= 0;
  const bPreset = ib >= 0;
  if (aPreset && bPreset) return ia - ib;
  if (aPreset) return -1;
  if (bPreset) return 1;
  return na.localeCompare(nb, undefined, { sensitivity: 'base' });
}
