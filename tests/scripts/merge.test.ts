import { describe, expect, it } from 'vitest';
import { mergePrompt, type MergeOptions, type WikiItem } from '../../scripts/lib/merge';
import type { Prompt } from '../../src/game/types';

const options: MergeOptions = { updateRarity: true, maxAliases: 6, pins: {} };

function item(label: string, views: number, extra: Partial<WikiItem> = {}): WikiItem {
  return { id: label, label, title: label, aliases: [], views, ...extra };
}

const prompt: Prompt = {
  id: 'p',
  question: 'q',
  answers: [{ canonical: 'Brazil', aliases: ['Brasil'], rarity: 5 }],
  wrongAnswers: ['Atlantis'],
};

describe('mergePrompt', () => {
  const items = [
    item('Brazil', 9000, { aliases: ['Federative Republic of Brazil'] }),
    item('Bolivia', 800, { aliases: ['Plurinational State of Bolivia'] }),
    item('Peru', 700),
    item('Chile', 600),
    item('Suriname', 10),
    item('Guyana', 20),
  ];

  it('adds missing answers and aliases without touching existing ones', () => {
    const { prompt: merged, report } = mergePrompt(prompt, items, options);
    const names = merged.answers.map((a) => a.canonical);
    expect(names).toEqual(expect.arrayContaining(['Brazil', 'Bolivia', 'Suriname']));
    expect(report.added).toHaveLength(5);
    const brazil = merged.answers.find((a) => a.canonical === 'Brazil')!;
    expect(brazil.aliases).toEqual(['Brasil', 'Federative Republic of Brazil']);
    expect(merged.answers.find((a) => a.canonical === 'Bolivia')!.aliases).toEqual(['Plurinational State of Bolivia']);
  });

  it('ranks by views: most viewed common, least viewed legendary', () => {
    const { prompt: merged } = mergePrompt(prompt, items, options);
    const rarity = (name: string) => merged.answers.find((a) => a.canonical === name)!.rarity;
    expect(rarity('Brazil')).toBe(1);
    expect(rarity('Suriname')).toBe(5);
  });

  it('keeps old rarity with keep-rarity but still tiers new answers', () => {
    const { prompt: merged } = mergePrompt(prompt, items, { ...options, updateRarity: false });
    expect(merged.answers.find((a) => a.canonical === 'Brazil')!.rarity).toBe(5);
  });

  it('applies pins after the automatic split', () => {
    const { prompt: merged } = mergePrompt(prompt, items, { ...options, pins: { Suriname: 2 } });
    expect(merged.answers.find((a) => a.canonical === 'Suriname')!.rarity).toBe(2);
  });

  it('never adds a form that clashes with another answer or a wrong answer', () => {
    const clashing = [item('Atlantis', 1), item('Peru', 5, { aliases: ['Brasil'] }), ...items.slice(0, 4)];
    const { prompt: merged } = mergePrompt(prompt, clashing, options);
    const forms = merged.answers.flatMap((a) => [a.canonical, ...(a.aliases ?? [])]);
    expect(forms.filter((f) => f === 'Brasil')).toHaveLength(1);
    expect(merged.answers.map((a) => a.canonical)).not.toContain('Atlantis');
  });

  it('leaves unrecognised existing answers untouched', () => {
    const odd: Prompt = { ...prompt, answers: [...prompt.answers, { canonical: 'Narnia', rarity: 3 }] };
    const { prompt: merged, report } = mergePrompt(odd, items, options);
    expect(report.unmatched).toEqual(['Narnia']);
    expect(merged.answers.find((a) => a.canonical === 'Narnia')!.rarity).toBe(3);
  });

  it('capitalises lowercase Wikidata labels and drops parenthetical suffixes', () => {
    const { prompt: merged } = mergePrompt(
      { ...prompt, answers: [] },
      [item('radius', 5, { title: 'Radius (bone)' }), ...items.slice(0, 4)],
      options,
    );
    expect(merged.answers.map((a) => a.canonical)).toContain('Radius');
  });

  it('keeps a legendary answer so the set stays playable', () => {
    const { prompt: merged } = mergePrompt(prompt, items, options);
    expect(merged.answers.some((a) => a.rarity === 5)).toBe(true);
  });
});

describe('alias filtering', () => {
  it('drops codes, digits, abbreviations and very long titles', () => {
    const noisy = item('Zedland', 5, {
      aliases: ['element 79', '₂₇Co', 'RSA', 'zed', 'The Very Long Official Name Of Zedland Republic', 'Zedlandia'],
    });
    const { prompt: merged } = mergePrompt({ ...prompt, answers: [] }, [noisy, ...[1, 2, 3, 4].map((n) => item(`Land${n}`, n))], options);
    expect(merged.answers.find((a) => a.canonical === 'Zedland')!.aliases).toEqual(['Zedlandia']);
  });
});
