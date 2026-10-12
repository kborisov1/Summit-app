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
  /** Strides the climber has covered so far, for scrolling the ground. */
  distance: number;
  /** Position in the leg cycle; whole numbers have the feet together. */
  phase: number;
  /** 0..1, how energetic the gait is: a walk at 0, a run at 1. Fixed per tier. */
  gait: number;
  /** 0..1, how wide the climber's legs and arms swing. */
  stride: number;
  /** Lift off the ground, in climber heights. */
  hop: number;
  /** 0..1, arms raised in triumph. */
  cheer: number;
  /** 0..1, knees buckling in a stumble. */
  stumble: number;
  done: boolean;
}

interface Tier {
  duration: number;
  rush: number;
  flash: number;
  /** Whole strides, so the climber ends with the feet together. */
  strides: number;
  gait: number;
  /** Whether the climb ends in a leap and a cheer. */
  leap: boolean;
}

// Rarer answers climb longer and with more drama, and the climber puts in
// more effort: a walk, a hike, a jog, a bounding run, then a run and a leap.
const TIERS: Record<Rarity, Tier> = {
  1: { duration: 1.4, rush: 0, flash: 0, strides: 2, gait: 0, leap: false },
  2: { duration: 1.8, rush: 0.2, flash: 0, strides: 3, gait: 0.25, leap: false },
  3: { duration: 2.2, rush: 0.45, flash: 0.35, strides: 5, gait: 0.5, leap: false },
  4: { duration: 2.6, rush: 0.7, flash: 0.6, strides: 7, gait: 0.75, leap: false },
  5: { duration: 3.2, rush: 1, flash: 1, strides: 8, gait: 1, leap: true },
};

/** Share of a leaping climb spent running up to the leap. */
const RUN_UP = 0.62;
/** Share of a leaping climb spent in the air. */
const LEAP_TIME = 0.2;
/** Strides covered in the air. */
const LEAP_DISTANCE = 2;
const LEAP_HEIGHT = 0.45;

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
      ...STANDING,
      stumble: Math.sin(Math.PI * Math.min(1, u * 1.6)) ** 2,
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
    ...climberMotion(tier, u),
    done,
  };
}

/** The climber at rest: feet together, arms down. */
export const STANDING = { distance: 0, phase: 0, gait: 0, stride: 0, hop: 0, cheer: 0, stumble: 0 } as const;

function climberMotion(tier: Tier, u: number) {
  if (!tier.leap) {
    const phase = tier.strides * easeInOut(u);
    // The swing opens as the climber sets off and closes on arrival.
    return { ...STANDING, distance: phase, phase, gait: tier.gait, stride: Math.sin(Math.PI * u) ** 0.5 };
  }
  const run = Math.min(1, u / RUN_UP);
  const air = Math.min(1, Math.max(0, (u - RUN_UP) / LEAP_TIME));
  // The run-up builds speed into the leap instead of slowing to a stop.
  const phase = tier.strides * (run - Math.sin(Math.PI * run) / Math.PI);
  return {
    ...STANDING,
    distance: phase + LEAP_DISTANCE * easeInOut(air),
    phase,
    gait: tier.gait,
    stride: Math.sin((Math.PI / 2) * Math.min(1, run * 4)) * (1 - air),
    hop: LEAP_HEIGHT * Math.sin(Math.PI * air),
    // Arms go up as the climber lands and stay up while the glow fades.
    cheer: smoothstep(RUN_UP + LEAP_TIME * 0.5, RUN_UP + LEAP_TIME, u) * (1 - smoothstep(0.94, 1, u)),
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
