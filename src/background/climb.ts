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
  /** Position in the stride cycle; whole numbers have the feet together. */
  phase: number;
  /** 0..1, how hard the runner works: a jog at 0, a sprint at 1. Fixed per tier. */
  effort: number;
  /** 0..1, how wide the legs and arms swing. */
  stride: number;
  /** Height of a leap, in runner heights. */
  hop: number;
  /** 0..1, how far into a leap's tucked pose the runner is. */
  tuck: number;
  /** 0..1, how deep the runner crouches: winding up for a leap, or soaking up a landing. */
  crouch: number;
  /** 0..1, both arms raised in triumph. */
  cheer: number;
  /** 0..1, stumbling and dropping a little. */
  slip: number;
  /** 0..1, how far the runner pulls ahead of the camera mid-climb. */
  lead: number;
  /** 0..1, how visible this climb's tier lines are. */
  lines: number;
  /** 0..1, how brightly the reached tier line is lit on arrival. */
  lit: number;
  /** 0..1, how visible the answer chip riding with the climber is. */
  chip: number;
  done: boolean;
}

interface Leap {
  /** When the leap starts and lands, as shares of the climb's movement. */
  from: number;
  to: number;
  /** Peak height, in runner heights. */
  height: number;
}

interface Tier {
  duration: number;
  rush: number;
  flash: number;
  /** Whole stride cycles run on the way, so the runner ends with the feet together. */
  strides: number;
  effort: number;
  leaps: Leap[];
}

// Rarer answers climb higher and with more drama: common ends in a small hop,
// uncommon skips twice, rare adds a proper leap, very rare two bigger ones,
// and legendary ends in a giant leap over the last lines and a cheer.
const TIERS: Record<Rarity, Tier> = {
  1: { duration: 2.0, rush: 0, flash: 0, strides: 4, effort: 0, leaps: [{ from: 0.62, to: 0.84, height: 0.18 }] },
  2: {
    duration: 2.4,
    rush: 0.2,
    flash: 0,
    strides: 5,
    effort: 0.25,
    leaps: [
      { from: 0.35, to: 0.53, height: 0.2 },
      { from: 0.68, to: 0.9, height: 0.3 },
    ],
  },
  3: {
    duration: 2.8,
    rush: 0.45,
    flash: 0.35,
    strides: 5,
    effort: 0.5,
    leaps: [
      { from: 0.18, to: 0.32, height: 0.22 },
      { from: 0.45, to: 0.76, height: 0.55 },
    ],
  },
  4: {
    duration: 3.2,
    rush: 0.7,
    flash: 0.6,
    strides: 6,
    effort: 0.75,
    leaps: [
      { from: 0.25, to: 0.5, height: 0.55 },
      { from: 0.6, to: 0.92, height: 0.8 },
    ],
  },
  5: {
    duration: 3.8,
    rush: 1,
    flash: 1,
    strides: 7,
    effort: 1,
    leaps: [
      { from: 0.18, to: 0.32, height: 0.3 },
      { from: 0.45, to: 1, height: 1.3 },
    ],
  },
};

/** Share of a climb's movement spent crouching before a leap, or after landing one. */
const CROUCH_TIME = 0.07;

/** Share of a climb spent moving; the rest lets the reached line glow before it fades. */
const ARRIVE = 0.82;

const STUMBLE_DURATION = 0.7;
const STEP_RATE = 2.2;
const STEP_HEIGHT = 0.006;

export function climbDuration(rarity: Rarity | null): number {
  return rarity === null ? STUMBLE_DURATION : TIERS[rarity].duration;
}

/** Seconds from the start of a climb until the climber arrives. */
export function climbArrival(rarity: Rarity | null): number {
  return rarity === null ? STUMBLE_DURATION : TIERS[rarity].duration * ARRIVE;
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
      slip: Math.sin(Math.PI * Math.min(1, u * 1.6)) ** 2,
      done,
    };
  }

  const tier = TIERS[rarity];
  const m = Math.min(1, u / ARRIVE);
  // Swells with the camera's speed, which peaks early, and settles on arrival.
  const swell = 6.75 * m * (1 - m) ** 2;
  // Each step lifts and lowers the camera with no hard bounce at the bottom.
  const step = Math.sin(elapsed * STEP_RATE * Math.PI) ** 2;
  const motion = runnerMotion(tier, m);
  return {
    travel: climbEase(m),
    bob: -STEP_HEIGHT * step * swell,
    shake: 0,
    rush: tier.rush * swell,
    // The glow builds toward arrival, then fades out.
    flash: tier.flash * Math.sin(Math.PI * u ** 1.6),
    ...motion,
    // A cheer winds down with the glow so the runner settles back to standing.
    cheer: motion.cheer * (1 - smoothstep(0.94, 1, u)),
    lines: smoothstep(0, 0.08, u) * (1 - smoothstep(0.9, 1, u)),
    lit: smoothstep(ARRIVE - 0.05, ARRIVE, u),
    // The chip hands over to the landing banner once the climber arrives.
    chip: smoothstep(0, 0.08, u) * (1 - smoothstep(ARRIVE - 0.02, ARRIVE + 0.06, u)),
    done,
  };
}

/** The runner at rest, standing. */
export const STANDING = {
  phase: 0,
  effort: 0,
  stride: 0,
  hop: 0,
  tuck: 0,
  crouch: 0,
  cheer: 0,
  slip: 0,
  lead: 0,
  lines: 0,
  lit: 0,
  chip: 0,
} as const;

/** The runner's motion while it moves, `m` running 0..1 to arrival. */
function runnerMotion(tier: Tier, m: number) {
  // Legs cycle only while running; in the air they hold the leap's pose.
  let air = 0;
  let hop = 0;
  let tuck = 0;
  let crouch = 0;
  let airborne = 0;
  for (const leap of tier.leaps) {
    const t = Math.min(1, Math.max(0, (m - leap.from) / (leap.to - leap.from)));
    airborne += Math.min(m, leap.to) > leap.from ? Math.min(m, leap.to) - leap.from : 0;
    // Bigger leaps tuck harder and crouch deeper; a small hop is a light skip.
    const scale = Math.min(1, leap.height / 0.5);
    if (t > 0 && t < 1) {
      air = Math.sin(Math.PI * t);
      hop = leap.height * air;
      tuck = air * (0.35 + 0.65 * scale);
    }
    // Wind up in a crouch just before take-off, and soak up the landing after.
    const windUp = (m - (leap.from - CROUCH_TIME)) / CROUCH_TIME;
    const soak = (m - leap.to) / CROUCH_TIME;
    const depth = 0.35 + 0.65 * scale;
    if (windUp > 0 && windUp < 1) crouch = Math.max(crouch, depth * Math.sin((Math.PI / 2) * windUp));
    if (soak > 0 && soak < 1) crouch = Math.max(crouch, depth * 0.8 * Math.sin(Math.PI * soak));
  }
  const airTime = tier.leaps.reduce((sum, leap) => sum + leap.to - leap.from, 0);
  const run = Math.min(1, Math.max(0, (m - airborne) / (1 - airTime)));
  return {
    ...STANDING,
    // The run keeps its pace into and out of each leap.
    phase: tier.strides * run,
    effort: tier.effort,
    // The swing opens as the runner sets off and closes on arrival.
    stride: Math.sin(Math.PI * run) ** 0.5 * (1 - air) * (1 - 0.6 * crouch),
    hop,
    tuck,
    crouch,
    lead: Math.sin(Math.PI * m) ** 1.5,
    // Legendary lands its giant leap with both arms up.
    cheer: tier.effort === 1 ? smoothstep(0.9, 1, m) : 0,
  };
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
