import { describe, expect, it } from 'vitest';
import { promptSets } from '../../src/game/content';
import type { PromptSet } from '../../src/game/types';
import { validateSet } from '../../src/game/validate';

describe('shipped content', () => {
  it('has at least one prompt set', () => {
    expect(promptSets.length).toBeGreaterThan(0);
  });

  it('has unique set ids', () => {
    const ids = promptSets.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(promptSets.map((s) => [s.id, s] as const))('%s is valid', (_id, set) => {
    expect(validateSet(set)).toEqual([]);
  });
});

describe('validateSet', () => {
  const base = (): PromptSet => ({
    id: 's',
    prompts: Array.from({ length: 7 }, (_, i) => ({
      id: `p${i}`,
      question: 'Q',
      answers: [{ canonical: 'Legend', rarity: 5 as const }],
    })),
  });

  it('accepts a minimal valid set', () => {
    expect(validateSet(base())).toEqual([]);
  });

  it('requires seven prompts', () => {
    const set = base();
    set.prompts.pop();
    expect(validateSet(set)).toEqual(['s: has 6 prompts, expected 7']);
  });

  it('requires a legendary answer on every prompt', () => {
    const set = base();
    set.prompts[2].answers = [{ canonical: 'Plain', rarity: 1 }];
    expect(validateSet(set)).toEqual(['s/p2: no legendary answer']);
  });

  it('flags forms shared by two answers and wrong answers that are accepted', () => {
    const set = base();
    set.prompts[0].answers.push({ canonical: 'Other', aliases: ['legend'], rarity: 1 });
    set.prompts[1].wrongAnswers = ['LEGEND'];
    expect(validateSet(set)).toEqual([
      's/p0: "legend" is used by both "Legend" and "Other"',
      's/p1: wrong answer "LEGEND" is also accepted as "Legend"',
    ]);
  });
});
