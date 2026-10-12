import type { Rarity } from '../game/types';

/**
 * The camera move played after each answer (scope "Experience").
 * `rarity` is null for a wrong answer or a timeout.
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
  done: boolean;
}

interface Tier {
  duration: number;
  rush: number;
  flash: number;
}

// Rarer answers climb longer and with more drama.
const TIERS: Record<Rarity, Tier> = {
  1: { duration: 1.4, rush: 0, flash: 0 },
  2: { duration: 1.8, rush: 0.2, flash: 0 },
  3: { duration: 2.2, rush: 0.45, flash: 0.35 },
  4: { duration: 2.6, rush: 0.7, flash: 0.6 },
  5: { duration: 3.2, rush: 1, flash: 1 },
};

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
      done,
    };
  }

  const tier = TIERS[rarity];
  // Swells in the middle of the climb and settles on arrival.
  const swell = Math.sin(Math.PI * u);
  return {
    travel: easeInOutCubic(u),
    bob: -STEP_HEIGHT * Math.abs(Math.sin(elapsed * STEP_RATE * Math.PI)) * swell,
    shake: 0,
    rush: tier.rush * swell,
    // The glow builds toward arrival, then fades out.
    flash: tier.flash * Math.sin(Math.PI * u ** 1.6),
    done,
  };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
