import type { PromptSet } from './types';

/** Day 0 of the rotation (architecture "Daily Selection"). */
export const EPOCH_DAY_KEY = '2026-01-01';

const MS_PER_DAY = 86_400_000;

/** Local calendar date as `YYYY-MM-DD`. */
export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole days between the epoch and a `YYYY-MM-DD` key. Negative before the epoch. */
export function dayNumberFromKey(dayKey: string): number {
  return Math.round((utcMidnight(dayKey) - utcMidnight(EPOCH_DAY_KEY)) / MS_PER_DAY);
}

/** Day number for the local calendar date of `date`. */
export function dayNumber(date: Date): number {
  return dayNumberFromKey(toDayKey(date));
}

function utcMidnight(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Picks the set for a day. Sets are ordered by id so the rotation does not
 * depend on file load order.
 */
export function selectSet(sets: readonly PromptSet[], day: number): PromptSet {
  if (sets.length === 0) throw new Error('No prompt sets available');
  const ordered = [...sets].sort((a, b) => a.id.localeCompare(b.id));
  const index = ((day % ordered.length) + ordered.length) % ordered.length;
  return ordered[index];
}
