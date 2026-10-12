import { describe, expect, it } from 'vitest';
import {
  displayAltitude,
  gainFor,
  hasReachedSummit,
  RARITY_GAIN,
  SUMMIT_ALTITUDE,
} from '../../src/game/scoring';
import type { Rarity } from '../../src/game/types';

const total = (rarities: Rarity[]) => rarities.reduce((sum, r) => sum + gainFor(r), 0);

describe('scoring', () => {
  it('gives no altitude for a wrong answer', () => {
    expect(gainFor(null)).toBe(0);
  });

  // Reference runs from scope "Altitude Scoring".
  it.each<[string, Rarity[], number, boolean]>([
    ['all common', [1, 1, 1, 1, 1, 1, 1], 910, false],
    ['all uncommon', [2, 2, 2, 2, 2, 2, 2], 2450, false],
    ['all rare', [3, 3, 3, 3, 3, 3, 3], 4550, false],
    ['all very rare', [4, 4, 4, 4, 4, 4, 4], 7000, false],
    ['6 legendary + 1 uncommon', [5, 5, 5, 5, 5, 5, 2], 8750, false],
    ['6 legendary + 1 rare', [5, 5, 5, 5, 5, 5, 3], 9050, true],
    ['5 legendary + 2 very rare', [5, 5, 5, 5, 5, 4, 4], 9000, true],
  ])('%s', (_name, rarities, raw, summit) => {
    const altitude = total(rarities);
    expect(altitude).toBe(raw);
    expect(hasReachedSummit(altitude)).toBe(summit);
    expect(displayAltitude(altitude)).toBe(Math.min(raw, SUMMIT_ALTITUDE));
  });

  it('cannot reach the summit before the seventh prompt', () => {
    expect(6 * RARITY_GAIN[5]).toBeLessThan(SUMMIT_ALTITUDE);
  });
});
