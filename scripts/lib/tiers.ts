import type { Rarity } from '../../src/game/types.ts';

export interface Ranked {
  key: string;
  views: number;
}

/**
 * Splits answers into five equal-sized rarity tiers by page views
 * (scope "Altitude Scoring": cutoffs come from a familiarity score).
 * Most viewed = tier 1 (common), least viewed = tier 5 (legendary).
 * Ties break on key so the result is deterministic.
 */
export function assignTiers(items: Ranked[]): Map<string, Rarity> {
  const sorted = [...items].sort((a, b) => b.views - a.views || a.key.localeCompare(b.key));
  const tiers = new Map<string, Rarity>();
  sorted.forEach((item, index) => {
    tiers.set(item.key, (Math.floor((index * 5) / sorted.length) + 1) as Rarity);
  });
  return tiers;
}
