import { describe, expect, it } from 'vitest';
import { climbDuration, climbFx } from '../../src/background/climb';

describe('climbFx', () => {
  it('travels from the old altitude to the new one', () => {
    expect(climbFx(3, 0).travel).toBe(0);
    // The camera sets off promptly and spends the back half settling.
    expect(climbFx(3, climbDuration(3) * 0.1).travel).toBeGreaterThan(0.05);
    expect(climbFx(3, climbDuration(3) / 2).travel).toBeGreaterThan(0.75);
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
    const d = climbDuration(5);
    const n = 400;
    // Speed relative to an even climb over the same time.
    const speeds = Array.from({ length: n }, (_, i) => (climbFx(5, (d * (i + 1)) / n).travel - climbFx(5, (d * i) / n).travel) * n);
    expect(Math.min(...speeds)).toBeGreaterThanOrEqual(0);
    expect(speeds[0]).toBeLessThan(1);
    expect(Math.max(...speeds)).toBeLessThan(2.75);
  });

  it('starts and ends the climber at rest in its holds', () => {
    for (const r of [1, 2, 3, 4, 5] as const) {
      const start = climbFx(r, 0);
      const end = climbFx(r, climbDuration(r));
      expect(start.phase).toBe(0);
      expect(start.reach).toBe(0);
      expect(Number.isInteger(Math.round(end.phase * 1e6) / 1e6)).toBe(true);
      expect(end.reach).toBeLessThan(1e-6);
      expect(end.lunge).toBeLessThan(1e-6);
      expect(end.cheer).toBeLessThan(1e-6);
    }
  });

  it('makes the climber work harder and make more moves for rarer answers', () => {
    const end = (r: 1 | 2 | 3 | 4 | 5) => climbFx(r, climbDuration(r));
    for (let r = 2; r <= 5; r++) {
      const prev = end((r - 1) as 1 | 2 | 3 | 4);
      const next = end(r as 2 | 3 | 4 | 5);
      expect(next.effort).toBeGreaterThan(prev.effort);
      expect(next.phase).toBeGreaterThan(prev.phase);
    }
  });

  it('ends a legendary climb with a lunge and a cheer', () => {
    const d = climbDuration(5);
    const samples = Array.from({ length: 200 }, (_, i) => climbFx(5, (d * i) / 199));
    expect(Math.max(...samples.map((fx) => fx.lunge))).toBeGreaterThan(0.3);
    expect(Math.max(...samples.map((fx) => fx.cheer))).toBeGreaterThan(0.9);
    for (const r of [1, 2, 3, 4] as const) {
      expect(climbFx(r, climbDuration(r) * 0.85).lunge).toBe(0);
      expect(climbFx(r, climbDuration(r) * 0.85).cheer).toBe(0);
    }
  });

  it('stumbles without climbing on a timeout', () => {
    const fx = climbFx(null, 0.1);
    expect(fx.travel).toBe(0);
    expect(fx.shake).not.toBe(0);
    expect(fx.rush).toBe(0);
    expect(fx.phase).toBe(0);
    expect(fx.slip).toBeGreaterThan(0);
    expect(climbFx(null, climbDuration(null)).done).toBe(true);
  });
});
