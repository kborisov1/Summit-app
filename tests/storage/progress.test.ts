import { describe, expect, it } from 'vitest';
import {
  currentStreak,
  emptyProgress,
  loadProgress,
  recordResult,
  saveProgress,
  STORAGE_KEY,
  type DayResult,
  type KeyValueStore,
} from '../../src/storage/progress';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const result = (altitude = 910): DayResult => ({
  setId: 'sample-001',
  altitude,
  reachedSummit: false,
  answers: [],
});

describe('progress storage', () => {
  it('round-trips through the store under a versioned key', () => {
    const store = memoryStore();
    const progress = recordResult(emptyProgress(), '2026-10-12', result());
    expect(saveProgress(store, progress)).toBe(true);
    expect(Object.keys(store.data)).toEqual([STORAGE_KEY]);
    expect(loadProgress(store)).toEqual(progress);
  });

  it('falls back to empty progress for missing, corrupt, or unknown data', () => {
    expect(loadProgress(memoryStore())).toEqual(emptyProgress());
    expect(loadProgress(memoryStore({ [STORAGE_KEY]: '{not json' }))).toEqual(emptyProgress());
    expect(loadProgress(memoryStore({ [STORAGE_KEY]: '{"version":99}' }))).toEqual(emptyProgress());
    expect(loadProgress(null)).toEqual(emptyProgress());
  });

  it('reports failure when the store throws', () => {
    const store: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadProgress(store)).toEqual(emptyProgress());
    expect(saveProgress(store, emptyProgress())).toBe(false);
  });
});

describe('streaks', () => {
  it('starts at one and grows on consecutive days', () => {
    let p = recordResult(emptyProgress(), '2026-10-10', result());
    expect(p.streak).toBe(1);
    p = recordResult(p, '2026-10-11', result());
    p = recordResult(p, '2026-10-12', result());
    expect(p.streak).toBe(3);
    expect(p.lastCompletedDay).toBe('2026-10-12');
  });

  it('resets after a missed day', () => {
    let p = recordResult(emptyProgress(), '2026-10-10', result());
    p = recordResult(p, '2026-10-12', result());
    expect(p.streak).toBe(1);
  });

  it('keeps the first result when the same day is recorded twice', () => {
    const first = recordResult(emptyProgress(), '2026-10-12', result(910));
    const again = recordResult(first, '2026-10-12', result(5000));
    expect(again).toBe(first);
  });

  it('shows the streak until the day after the last run, then zero', () => {
    const p = recordResult(
      recordResult(emptyProgress(), '2026-10-11', result()),
      '2026-10-12',
      result(),
    );
    expect(currentStreak(p, '2026-10-12')).toBe(2);
    expect(currentStreak(p, '2026-10-13')).toBe(2);
    expect(currentStreak(p, '2026-10-14')).toBe(0);
    expect(currentStreak(emptyProgress(), '2026-10-12')).toBe(0);
  });
});
