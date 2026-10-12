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
  /** Lunge up the face, in climber heights. */
  lunge: number;
  /** 0..1, both arms raised in triumph. */
  cheer: number;
  /** 0..1, losing the holds and dropping a little. */
  slip: number;
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

// Rarer answers climb longer and with more drama, and the climber works
// harder: a careful move or two, steady climbing, a quick climb, a scramble,
// then a scramble that ends in a lunge and a cheer.
const TIERS: Record<Rarity, Tier> = {
  1: { duration: 1.4, rush: 0, flash: 0, moves: 1, effort: 0, lunge: false },
  2: { duration: 1.8, rush: 0.2, flash: 0, moves: 2, effort: 0.25, lunge: false },
  3: { duration: 2.2, rush: 0.45, flash: 0.35, moves: 3, effort: 0.5, lunge: false },
  4: { duration: 2.6, rush: 0.7, flash: 0.6, moves: 5, effort: 0.75, lunge: false },
  5: { duration: 3.2, rush: 1, flash: 1, moves: 6, effort: 1, lunge: true },
};

/** Share of a lunging climb spent scrambling up to the lunge. */
const SCRAMBLE = 0.6;
/** Share of a lunging climb spent lunging. */
const LUNGE_TIME = 0.22;
const LUNGE_HEIGHT = 0.35;

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
    ...climberMotion(tier, u),
    done,
  };
}

/** The climber at rest, holding on to the face. */
export const HOLDING = { phase: 0, effort: 0, reach: 0, lunge: 0, cheer: 0, slip: 0 } as const;

function climberMotion(tier: Tier, u: number) {
  if (!tier.lunge) {
    const phase = tier.moves * easeInOut(u);
    // The reach opens as the climber sets off and closes on arrival.
    return { ...HOLDING, phase, effort: tier.effort, reach: Math.sin(Math.PI * u) ** 0.5 };
  }
  const scramble = Math.min(1, u / SCRAMBLE);
  const air = Math.min(1, Math.max(0, (u - SCRAMBLE) / LUNGE_TIME));
  // The scramble builds speed into the lunge instead of slowing to a stop.
  const phase = tier.moves * (scramble - Math.sin(Math.PI * scramble) / Math.PI);
  return {
    ...HOLDING,
    phase,
    effort: tier.effort,
    reach: Math.sin((Math.PI / 2) * Math.min(1, scramble * 4)) * (1 - air),
    lunge: LUNGE_HEIGHT * Math.sin(Math.PI * air),
    // Arms go up at the top of the lunge and stay up while the glow fades.
    cheer: smoothstep(SCRAMBLE + LUNGE_TIME * 0.3, SCRAMBLE + LUNGE_TIME, u) * (1 - smoothstep(0.94, 1, u)),
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
