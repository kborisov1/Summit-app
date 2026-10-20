import { describe, expect, it } from 'vitest';
import { assignTiers } from '../../scripts/lib/tiers';

describe('assignTiers', () => {
  it('gives the most viewed tier 1 and the least viewed tier 5', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ key: `a${i}`, views: 1000 - i * 10 }));
    const tiers = assignTiers(items);
    expect(tiers.get('a0')).toBe(1);
    expect(tiers.get('a1')).toBe(1);
    expect(tiers.get('a4')).toBe(3);
    expect(tiers.get('a9')).toBe(5);
  });

  it('splits into five near-equal groups', () => {
    const items = Array.from({ length: 23 }, (_, i) => ({ key: `a${i}`, views: 500 - i }));
    const counts = [0, 0, 0, 0, 0];
    for (const tier of assignTiers(items).values()) counts[tier - 1]++;
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('breaks ties deterministically by key', () => {
    const items = [
      { key: 'b', views: 5 },
      { key: 'a', views: 5 },
    ];
    expect([...assignTiers(items).keys()]).toEqual(['a', 'b']);
  });
});
