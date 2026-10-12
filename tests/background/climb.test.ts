import { describe, expect, it } from 'vitest';
import { climbArrival, climbDuration, climbFx } from '../../src/background/climb';

describe('climbFx', () => {
  it('travels from the old altitude to the new one', () => {
    expect(climbFx(3, 0).travel).toBe(0);
    // The camera sets off promptly and spends the back half settling.
    expect(climbFx(3, climbArrival(3) * 0.1).travel).toBeGreaterThan(0.05);
    expect(climbFx(3, climbArrival(3) / 2).travel).toBeGreaterThan(0.75);
    expect(climbFx(3, climbArrival(3)).travel).toBe(1);
    const end = climbFx(3, climbDuration(3));
    expect(end.travel).toBe(1);
    expect(end.done).toBe(true);
  });

  it('settles all effects on arrival', () => {
    const end = climbFx(5, climbDuration(5));
    expect(Math.abs(end.rush)).toBeLessThan(1e-9);
    expect(Math.abs(end.flash)).toBeLessThan(1e-9);
    expect(Math.abs(end.bob)).toBeLessThan(1e-9);
  });

  it('makes rarer answers climb longer and more dramatically', () => {
    expect(climbDuration(5)).toBeGreaterThan(climbDuration(1));
    const mid = (r: 1 | 5) => climbFx(r, climbDuration(r) / 2);
    expect(mid(5).rush).toBeGreaterThan(mid(1).rush);
    expect(mid(1).flash).toBe(0);
    expect(mid(5).flash).toBeGreaterThan(0);
  });

  it('moves the camera without a jolt or a lurch', () => {
    const d = climbArrival(5);
    const n = 400;
    // Speed relative to an even climb over the same time.
    const speeds = Array.from({ length: n }, (_, i) => (climbFx(5, (d * (i + 1)) / n).travel - climbFx(5, (d * i) / n).travel) * n);
    expect(Math.min(...speeds)).toBeGreaterThanOrEqual(0);
    expect(speeds[0]).toBeLessThan(1);
    expect(Math.max(...speeds)).toBeLessThan(2.75);
  });

  it('starts and ends the runner standing with its feet together', () => {
    for (const r of [1, 2, 3, 4, 5] as const) {
      const start = climbFx(r, 0);
      const end = climbFx(r, climbDuration(r));
      expect(start.phase).toBe(0);
      expect(start.stride).toBe(0);
      expect(Number.isInteger(Math.round(end.phase * 1e6) / 1e6)).toBe(true);
      expect(end.stride).toBeLessThan(1e-6);
      expect(end.hop).toBeLessThan(1e-6);
      expect(end.cheer).toBeLessThan(1e-6);
    }
  });

  it('makes the runner work harder for rarer answers', () => {
    const end = (r: 1 | 2 | 3 | 4 | 5) => climbFx(r, climbDuration(r));
    for (let r = 2; r <= 5; r++) {
      const prev = end((r - 1) as 1 | 2 | 3 | 4);
      const next = end(r as 2 | 3 | 4 | 5);
      expect(next.effort).toBeGreaterThan(prev.effort);
    }
  });

  it('arrives before the climb ends, lighting the reached line before the lines fade', () => {
    for (const r of [1, 2, 3, 4, 5] as const) {
      expect(climbArrival(r)).toBeLessThan(climbDuration(r));
      const mid = climbFx(r, climbArrival(r) / 2);
      expect(mid.lines).toBe(1);
      expect(mid.lit).toBe(0);
      expect(mid.chip).toBe(1);
      const arrived = climbFx(r, climbArrival(r) + 0.15);
      expect(arrived.lit).toBe(1);
      expect(arrived.chip).toBeLessThan(0.5);
      const end = climbFx(r, climbDuration(r));
      expect(end.lines).toBe(0);
      expect(end.chip).toBe(0);
    }
  });

  it('pulls the runner ahead of the camera mid-climb and settles it on arrival', () => {
    for (const r of [1, 2, 3, 4, 5] as const) {
      expect(climbFx(r, 0).lead).toBe(0);
      expect(climbFx(r, climbArrival(r) / 2).lead).toBeGreaterThan(0.5);
      expect(climbFx(r, climbArrival(r)).lead).toBeLessThan(1e-6);
    }
  });

  it('adds more leaps for rarer answers, ending legendary in a giant one', () => {
    const leaps = (r: 1 | 2 | 3 | 4 | 5) => {
      const samples = Array.from({ length: 400 }, (_, i) => climbFx(r, (climbDuration(r) * i) / 399).hop);
      const count = samples.filter((h, i) => h > 0 && (samples[i - 1] ?? 0) === 0).length;
      return { count, peak: Math.max(...samples) };
    };
    expect(leaps(1).count).toBe(0);
    expect(leaps(2).count).toBe(0);
    expect(leaps(3).count).toBe(1);
    expect(leaps(4).count).toBe(2);
    expect(leaps(5).count).toBe(1);
    expect(leaps(4).peak).toBeGreaterThan(leaps(3).peak);
    expect(leaps(5).peak).toBeGreaterThan(leaps(4).peak);
  });

  it('ends a legendary climb with a cheer', () => {
    const d = climbDuration(5);
    const samples = Array.from({ length: 200 }, (_, i) => climbFx(5, (d * i) / 199));
    expect(Math.max(...samples.map((fx) => fx.cheer))).toBeGreaterThan(0.9);
    for (const r of [1, 2, 3, 4] as const) {
      expect(climbFx(r, climbDuration(r) * 0.85).cheer).toBe(0);
    }
  });

  it('stumbles without climbing on a timeout', () => {
    const fx = climbFx(null, 0.1);
    expect(fx.travel).toBe(0);
    expect(fx.shake).not.toBe(0);
    expect(fx.rush).toBe(0);
    expect(fx.phase).toBe(0);
    expect(fx.lead).toBe(0);
    expect(fx.lines).toBe(0);
    expect(fx.slip).toBeGreaterThan(0);
    expect(climbFx(null, climbDuration(null)).done).toBe(true);
  });
});
