import { dayNumberFromKey } from '../game/daily';
import type { Rarity } from '../game/types';

/** Bump the suffix when the stored shape changes (architecture "State and Persistence"). */
export const STORAGE_KEY = 'summit:progress:v1';

export interface DayResult {
  setId: string;
  altitude: number;
  reachedSummit: boolean;
  answers: { promptId: string; input: string; answer: string | null; rarity: Rarity | null }[];
}

export interface Progress {
  version: 1;
  lastCompletedDay: string | null;
  streak: number;
  results: Record<string, DayResult>;
}

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export function emptyProgress(): Progress {
  return { version: 1, lastCompletedDay: null, streak: 0, results: {} };
}

function isProgress(value: unknown): value is Progress {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    (v.lastCompletedDay === null || typeof v.lastCompletedDay === 'string') &&
    typeof v.streak === 'number' &&
    typeof v.results === 'object' &&
    v.results !== null
  );
}

/** Missing, unreadable, or corrupt data falls back to empty progress. */
export function loadProgress(store: KeyValueStore | null): Progress {
  if (!store) return emptyProgress();
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (raw === null) return emptyProgress();
    const parsed: unknown = JSON.parse(raw);
    return isProgress(parsed) ? parsed : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

/** Returns false when storage is unavailable (private mode, quota). */
export function saveProgress(store: KeyValueStore | null, progress: Progress): boolean {
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

/**
 * Records a finished run. Re-recording the same day keeps the first result
 * and does not change the streak.
 */
export function recordResult(progress: Progress, dayKey: string, result: DayResult): Progress {
  if (progress.results[dayKey]) return progress;

  const last = progress.lastCompletedDay;
  const consecutive = last !== null && dayNumberFromKey(dayKey) - dayNumberFromKey(last) === 1;

  return {
    ...progress,
    lastCompletedDay: dayKey,
    streak: consecutive ? progress.streak + 1 : 1,
    results: { ...progress.results, [dayKey]: result },
  };
}

/** Streak to show today: it survives until the end of the day after the last run. */
export function currentStreak(progress: Progress, todayKey: string): number {
  if (progress.lastCompletedDay === null) return 0;
  const gap = dayNumberFromKey(todayKey) - dayNumberFromKey(progress.lastCompletedDay);
  return gap === 0 || gap === 1 ? progress.streak : 0;
}

/** `window.localStorage`, or null when it is unavailable. */
export function browserStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
