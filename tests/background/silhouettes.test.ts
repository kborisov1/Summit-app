import { describe, expect, it } from 'vitest';
import { kindAt } from '../../src/background/silhouettes';

describe('kindAt', () => {
  it('changes what stands on the ledges with the zone', () => {
    // A middle roll sits away from the seams, so each zone gives its own kinds.
    expect(['pine', 'boulder']).toContain(kindAt(800, 0.5, 0.3));
    expect(kindAt(800, 0.5, 0.3)).toBe('pine');
    expect(['crag', 'boulder']).toContain(kindAt(3000, 0.5, 0.3));
    expect(['serac', 'crag']).toContain(kindAt(6000, 0.5, 0.3));
    expect(kindAt(8500, 0.5, 0.3)).toBe('windrock');
  });

  it('mingles neighbouring kinds near a zone seam', () => {
    // Just below the treeline, a high roll already reaches alpine kinds.
    expect(kindAt(1800, 0.95, 0.3)).toBe('crag');
    expect(kindAt(1800, 0.05, 0.3)).toBe('pine');
  });
});
