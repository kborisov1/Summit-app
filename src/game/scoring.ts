import type { Rarity } from './types';

// Values from scope "Altitude Scoring".
export const SUMMIT_ALTITUDE = 8848;
export const PROMPTS_PER_RUN = 7;

export const RARITY_GAIN: Record<Rarity, number> = {
  1: 130,
  2: 350,
  3: 650,
  4: 1000,
  5: 1400,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  1: 'Hobby climber',
  2: 'Weekend warrior',
  3: 'Mountain goat',
  4: 'Alpine legend',
  5: 'Himalayan madman',
};

/** A line of colour for each tier on the landing banner. */
export const RARITY_QUIP: Record<Rarity, string> = {
  1: 'The answer everyone reaches for.',
  2: 'A step off the beaten trail.',
  3: 'Few climbers come this way.',
  4: 'Thin air, rare thinking.',
  5: 'Hardly anyone has stood here.',
};

export function gainFor(rarity: Rarity | null): number {
  return rarity === null ? 0 : RARITY_GAIN[rarity];
}

/** Gains are summed raw; only the displayed value is capped. */
export function displayAltitude(rawAltitude: number): number {
  return Math.min(rawAltitude, SUMMIT_ALTITUDE);
}

export function hasReachedSummit(rawAltitude: number): boolean {
  return rawAltitude >= SUMMIT_ALTITUDE;
}
