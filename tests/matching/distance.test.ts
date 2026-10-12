import { describe, expect, it } from 'vitest';
import { editDistance, typoBudget } from '../../src/matching/distance';

describe('editDistance', () => {
  it('is zero for identical strings', () => {
    expect(editDistance('femur', 'femur')).toBe(0);
  });

  it('counts insertions, deletions, and substitutions', () => {
    expect(editDistance('femur', 'femr')).toBe(1);
    expect(editDistance('femur', 'femurs')).toBe(1);
    expect(editDistance('femur', 'lemur')).toBe(1);
    expect(editDistance('', 'abc')).toBe(3);
  });

  it('counts an adjacent transposition as one edit', () => {
    expect(editDistance('tibia', 'tibai')).toBe(1);
    expect(editDistance('beagle', 'baegle')).toBe(1);
  });
});

describe('typoBudget', () => {
  it('allows no typos in short answers', () => {
    expect(typoBudget('lab')).toBe(0);
    expect(typoBudget('gold')).toBe(0);
  });

  it('scales with length and ignores spaces', () => {
    expect(typoBudget('femur')).toBe(1);
    expect(typoBudget('sternum')).toBe(1);
    expect(typoBudget('clavicle')).toBe(2);
    expect(typoBudget('el greco')).toBe(1);
  });
});
