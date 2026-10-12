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
  1: 'Common',
  2: 'Uncommon',
  3: 'Rare',
  4: 'Very rare',
  5: 'Legendary',
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
