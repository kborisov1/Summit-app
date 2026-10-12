import { describe, expect, it } from 'vitest';
import type { Prompt } from '../../src/game/types';
import { matchAnswer } from '../../src/matching/match';

const prompt: Prompt = {
  id: 'test',
  question: 'Name a thing.',
  answers: [
    { canonical: 'Femur', aliases: ['Thigh bone'], rarity: 1 },
    { canonical: 'Clavicle', aliases: ['Collarbone'], rarity: 2 },
    { canonical: 'Nigeria', rarity: 1 },
    { canonical: 'Niger', rarity: 4 },
    { canonical: 'Hamlet', rarity: 1 },
    { canonical: 'Henry V', aliases: ['Henry 5'], rarity: 4 },
    { canonical: 'Lab', rarity: 1 },
    { canonical: 'Stapes', rarity: 5 },
  ],
  wrongAnswers: ['Hamnet', 'Henry 4', 'Staples'],
};

function matched(input: string): string | null {
  const result = matchAnswer(prompt, input);
  return result.kind === 'match' ? result.answer.canonical : null;
}

describe('matchAnswer', () => {
  it('matches canonical forms and aliases exactly after normalization', () => {
    expect(matchAnswer(prompt, 'FEMUR')).toMatchObject({ kind: 'match', exact: true });
    expect(matched('thigh-bone')).toBe('Femur');
    expect(matched('collarbone')).toBe('Clavicle');
    expect(matched('Henry 5')).toBe('Henry V');
  });

  it('accepts small typos within the length budget', () => {
    expect(matchAnswer(prompt, 'femr')).toMatchObject({ kind: 'match', exact: false });
    expect(matched('clavical')).toBe('Clavicle');
    expect(matched('clavcile')).toBe('Clavicle');
  });

  it('rejects typos beyond the budget', () => {
    expect(matched('fmr')).toBeNull();
    expect(matched('lob')).toBeNull();
    expect(matched('clovicil')).toBeNull();
  });

  it('prefers an exact match over a closer-looking fuzzy one', () => {
    expect(matched('niger')).toBe('Niger');
    expect(matched('nigeria')).toBe('Nigeria');
  });

  it('rejects input that is equally close to two different answers', () => {
    expect(matched('nigera')).toBeNull();
  });

  it('rejects known wrong answers, exact or near', () => {
    expect(matched('Hamnet')).toBeNull();
    expect(matched('staples')).toBeNull();
    expect(matched('stapels')).toBeNull();
  });

  it('never fuzzes across different numbers', () => {
    expect(matched('Henry 6')).toBeNull();
    expect(matched('Henri 5')).toBe('Henry V');
  });

  it('misses on empty or unrelated input', () => {
    expect(matched('')).toBeNull();
    expect(matched('   ')).toBeNull();
    expect(matched('banana')).toBeNull();
  });
});
