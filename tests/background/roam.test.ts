import { describe, expect, it } from 'vitest';
import { ROAM_START, roamGoal, stepRoam, type Roam, type RoamInput } from '../../src/background/roam';

const base: RoamInput = { dt: 1 / 60, time: 0, size: 80, range: 120, climb: null, typing: false, hop: 0 };

/** Steps the runner for `seconds`, letting `input` vary with time. */
function run(seconds: number, input: (t: number) => Partial<RoamInput> = () => ({}), from: Roam = ROAM_START) {
  let roam = from;
  const trace: Roam[] = [];
  for (let t = 0; t < seconds; t += base.dt) {
    roam = stepRoam(roam, { ...base, time: t, ...input(t) });
    trace.push(roam);
  }
  return { roam, trace };
}

describe('stepRoam', () => {
  it('strolls about between answers, staying inside its lane', () => {
    const { trace } = run(60);
    const xs = trace.map((r) => r.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(base.range);
    expect(Math.max(...xs.map(Math.abs))).toBeLessThanOrEqual(base.range);
    // It walks its legs while strolling and stands still in between.
    expect(Math.max(...trace.map((r) => r.walking))).toBeGreaterThan(0.5);
    expect(trace.some((r) => r.walking === 0)).toBe(true);
  });

  it('faces the way it heads, turning both ways', () => {
    const { trace } = run(60);
    for (const r of trace) {
      if (Math.abs(r.v) > base.size * 0.4 && Math.abs(r.facing) === 1) expect(r.facing).toBe(Math.sign(r.v));
    }
    expect(trace.some((r) => r.facing === -1)).toBe(true);
    expect(trace.some((r) => r.facing === 1)).toBe(true);
  });

  it('runs across the lane during a climb', () => {
    const start = { ...ROAM_START, x: 60 };
    const { roam } = run(2, () => ({ climb: { id: 3, startX: 60 } }), start);
    expect(roam.x).toBeLessThan(0);
    expect(roam.walking).toBe(0);
    expect(roamGoal(start, { ...base, climb: { id: 3, startX: -60 } })).toBeGreaterThan(0);
  });

  it('stops to look up while the player types', () => {
    const moving = { ...ROAM_START, v: 60 };
    const { roam } = run(2, () => ({ typing: true }), moving);
    expect(Math.abs(roam.v)).toBeLessThan(1);
  });

  it('leans into its motion and pitches with a leap', () => {
    const right = run(1.5, () => ({ climb: { id: 1, startX: -100 } }), { ...ROAM_START, x: -100 });
    expect(right.trace.some((r) => r.tilt > 0.05)).toBe(true);
    // Facing right, rising tips the nose up (a negative tilt), and falling tips it down.
    const rising = stepRoam({ ...ROAM_START, lastHop: 0 }, { ...base, dt: 0.1, hop: 0.2 });
    const falling = stepRoam({ ...ROAM_START, lastHop: 0.2 }, { ...base, dt: 0.1, hop: 0 });
    expect(rising.tilt).toBeLessThan(0);
    expect(falling.tilt).toBeGreaterThan(0);
  });
});
