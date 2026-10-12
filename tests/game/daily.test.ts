import { describe, expect, it } from 'vitest';
import { dayNumber, dayNumberFromKey, selectSet, toDayKey } from '../../src/game/daily';
import type { PromptSet } from '../../src/game/types';

const set = (id: string): PromptSet => ({ id, prompts: [] });

describe('daily selection', () => {
  it('formats the local date as a day key', () => {
    expect(toDayKey(new Date(2026, 9, 12, 23, 59))).toBe('2026-10-12');
    expect(toDayKey(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
  });

  it('counts days from the epoch, including across DST changes', () => {
    expect(dayNumberFromKey('2026-01-01')).toBe(0);
    expect(dayNumberFromKey('2026-01-02')).toBe(1);
    expect(dayNumberFromKey('2025-12-31')).toBe(-1);
    expect(dayNumberFromKey('2026-03-30') - dayNumberFromKey('2026-03-28')).toBe(2);
    expect(dayNumberFromKey('2026-12-31')).toBe(364);
  });

  it('gives the same day number all day long', () => {
    expect(dayNumber(new Date(2026, 9, 12, 0, 0))).toBe(dayNumber(new Date(2026, 9, 12, 23, 59)));
  });

  it('rotates through sets in id order regardless of input order', () => {
    const sets = [set('c'), set('a'), set('b')];
    expect([0, 1, 2, 3].map((d) => selectSet(sets, d).id)).toEqual(['a', 'b', 'c', 'a']);
  });

  it('handles days before the epoch', () => {
    const sets = [set('a'), set('b'), set('c')];
    expect(selectSet(sets, -1).id).toBe('c');
  });

  it('throws when there is no content', () => {
    expect(() => selectSet([], 0)).toThrow();
  });
});
