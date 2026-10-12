import { RARITY_GAIN } from '../game/scoring';
import type { Rarity } from '../game/types';

/**
 * The camera move and climber motion played after each answer (scope
 * "Experience"). `rarity` is null for a timeout.
 */
export interface ClimbFx {
  /** 0..1, how far the camera has travelled from the old altitude to the new one. */
  travel: number;
  /** Vertical camera sway from footsteps, as a fraction of screen height. */
  bob: number;
  /** Horizontal shake for a stumble, as a fraction of screen width. */
  shake: number;
  /** 0..1, strength of the updraft streaks and cloud rush. */
  rush: number;
  /** 0..1, strength of the arrival glow. */
  flash: number;
  /**
   * Position in the climbing cycle: one whole cycle is a reach with each hand.
   * Whole numbers have the climber in its resting hold.
   */
  phase: number;
  /** 0..1, how hard the climber works: careful moves at 0, a scramble at 1. Fixed per tier. */
  effort: number;
  /** 0..1, how far the hands and feet reach on each move. */
  reach: number;
  /** 0..1, how far off the rock the climber is in a lunge. */
  lunge: number;
  /** 0..1, both arms raised in triumph. */
  cheer: number;
  /** 0..1, losing the holds and dropping a little. */
  slip: number;
  /**
   * How far the climber has climbed up the wall, and how far the wall has
   * scrolled back down, both as a share of the wall's climbing room. They
   * meet at the end, so the reached tier line becomes the new base.
   */
  rise: number;
  scroll: number;
  /** 0..1, how visible the tier lines are. */
  lines: number;
  /** 0..1, how brightly the reached tier line is lit. */
  lit: number;
  done: boolean;
}

interface Tier {
  duration: number;
  rush: number;
  flash: number;
  /** Whole climbing cycles, so the climber ends back in its resting hold. */
  moves: number;
  effort: number;
  /** Whether the climb ends in a lunge up the face and a cheer. */
  lunge: boolean;
}

// Rarer answers climb higher and with more drama, and the climber works
// harder: a careful move, steady climbing, a quick climb, a scramble, then a
// scramble that ends in a lunge and a cheer.
const TIERS: Record<Rarity, Tier> = {
  1: { duration: 2.2, rush: 0, flash: 0, moves: 1, effort: 0, lunge: false },
  2: { duration: 2.6, rush: 0.2, flash: 0, moves: 2, effort: 0.25, lunge: false },
  3: { duration: 3.0, rush: 0.45, flash: 0.35, moves: 3, effort: 0.5, lunge: false },
  4: { duration: 3.4, rush: 0.7, flash: 0.6, moves: 4, effort: 0.75, lunge: false },
  5: { duration: 4.0, rush: 1, flash: 1, moves: 4, effort: 1, lunge: true },
};

// The climb's beats, as shares of its duration: climb to the line, hold
// there while it lights up, then scroll the wall down to make it the base.
const CLIMB_END = 0.66;
const SCROLL_START = 0.76;
/** Share of a lunging climb's ascent covered by the scramble before the lunge. */
const SCRAMBLE_SHARE = 0.7;
/** Share of a lunging climb's ascent time spent scrambling. */
const SCRAMBLE_TIME = 0.72;

/**
 * Height of a tier's line on the wall, as a share of the climbing room.
 * Spacing follows the altitude gains, squashed so common is still a climb.
 */
export function tierLine(rarity: Rarity): number {
  return (RARITY_GAIN[rarity] / RARITY_GAIN[5]) ** 0.55;
}

const STUMBLE_DURATION = 0.7;
const STEP_RATE = 2.2;
const STEP_HEIGHT = 0.006;

export function climbDuration(rarity: Rarity | null): number {
  return rarity === null ? STUMBLE_DURATION : TIERS[rarity].duration;
}

export function climbFx(rarity: Rarity | null, elapsed: number): ClimbFx {
  const duration = climbDuration(rarity);
  const u = Math.min(1, Math.max(0, elapsed / duration));
  const done = u >= 1;

  if (rarity === null) {
    const decay = (1 - u) ** 2;
    return {
      travel: 0,
      bob: -0.004 * Math.sin(Math.PI * u),
      shake: 0.006 * Math.sin(elapsed * 38) * decay,
      rush: 0,
      flash: 0,
      ...HOLDING,
      slip: Math.sin(Math.PI * Math.min(1, u * 1.6)) ** 2,
      done,
    };
  }

  const tier = TIERS[rarity];
  // Swells with the camera's speed, which peaks early, and settles on arrival.
  const swell = 6.75 * u * (1 - u) ** 2;
  // Each step lifts and lowers the camera with no hard bounce at the bottom.
  const step = Math.sin(elapsed * STEP_RATE * Math.PI) ** 2;
  return {
    travel: climbEase(u),
    bob: -STEP_HEIGHT * step * swell,
    shake: 0,
    rush: tier.rush * swell,
    // The glow builds toward arrival, then fades out.
    flash: tier.flash * Math.sin(Math.PI * u ** 1.6),
    ...climberMotion(rarity, tier, u),
    done,
  };
}

/** The climber at rest, holding on to the face. */
export const HOLDING = {
  phase: 0,
  effort: 0,
  reach: 0,
  lunge: 0,
  cheer: 0,
  slip: 0,
  rise: 0,
  scroll: 0,
  lines: 0,
  lit: 0,
} as const;

function climberMotion(rarity: Rarity, tier: Tier, u: number) {
  const line = tierLine(rarity);
  const climb = Math.min(1, u / CLIMB_END);
  const wall = {
    scroll: line * easeInOut(Math.min(1, Math.max(0, (u - SCROLL_START) / (1 - SCROLL_START)))),
    lines: smoothstep(0, 0.12, u) * (1 - smoothstep(0.8, 1, u)),
    lit: smoothstep(CLIMB_END - 0.06, CLIMB_END + 0.04, u) * (1 - smoothstep(0.9, 1, u)),
  };
  if (!tier.lunge) {
    const phase = tier.moves * easeInOut(climb);
    // The reach opens as the climber sets off and closes on arrival.
    return { ...HOLDING, ...wall, phase, effort: tier.effort, reach: Math.sin(Math.PI * climb) ** 0.5, rise: line * easeInOut(climb) };
  }
  const scramble = Math.min(1, climb / SCRAMBLE_TIME);
  const air = Math.min(1, Math.max(0, (climb - SCRAMBLE_TIME) / (1 - SCRAMBLE_TIME)));
  // The scramble builds speed into the lunge instead of slowing to a stop.
  const phase = tier.moves * (scramble - Math.sin(Math.PI * scramble) / Math.PI);
  const ascent = SCRAMBLE_SHARE * phase / tier.moves + (1 - SCRAMBLE_SHARE) * Math.sin((Math.PI / 2) * air);
  return {
    ...HOLDING,
    ...wall,
    phase,
    effort: tier.effort,
    reach: Math.sin((Math.PI / 2) * Math.min(1, scramble * 4)) * (1 - air),
    lunge: Math.sin(Math.PI * air),
    rise: line * ascent,
    // Arms go up as the climber lands on the line and stay up while it glows.
    cheer: smoothstep(CLIMB_END - 0.04, CLIMB_END + 0.04, u) * (1 - smoothstep(0.9, 1, u)),
  };
}

function easeInOut(u: number): number {
  return (1 - Math.cos(Math.PI * u)) / 2;
}

function smoothstep(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// cubic-bezier(0.3, 0.15, 0.2, 1): sets off at once, without a jolt, and
// spends the rest of the climb settling, so the camera keeps pace with the
// altitude meter instead of lagging and then lurching through the middle.
const EASE_X1 = 0.3;
const EASE_Y1 = 0.15;
const EASE_X2 = 0.2;
const EASE_Y2 = 1;

function climbEase(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  // The curve's x is monotonic in its parameter, so bisection finds it.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (bezier(EASE_X1, EASE_X2, mid) < u) lo = mid;
    else hi = mid;
  }
  return bezier(EASE_Y1, EASE_Y2, (lo + hi) / 2);
}

function bezier(a: number, b: number, t: number): number {
  const s = 1 - t;
  return 3 * s * s * t * a + 3 * s * t * t * b + t * t * t;
}
