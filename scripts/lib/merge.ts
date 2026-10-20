import { normalize } from '../../src/matching/normalize.ts';
import type { Answer, Prompt, Rarity } from '../../src/game/types.ts';
import { assignTiers } from './tiers.ts';

export interface WikiItem {
  id: string;
  label: string;
  /** English Wikipedia article title. */
  title: string;
  aliases: string[];
  /** Labels in other languages (for example "Brasil"). */
  labels: string[];
  views: number;
}

export interface MergeOptions {
  updateRarity: boolean;
  maxAliases: number;
  /** Hand-set tiers by canonical answer, applied after the automatic split. */
  pins: Record<string, Rarity>;
}

export interface MergeReport {
  items: number;
  matched: number;
  added: string[];
  aliasesAdded: number;
  rarityChanges: { canonical: string; from: Rarity; to: Rarity }[];
  /** Existing answers Wikidata did not recognise; left untouched. */
  unmatched: string[];
  /** Wikidata items not added because their name clashes with an existing form. */
  clashes: string[];
  tiered: boolean;
}

/** "Radius (bone)" -> "Radius"; Wikidata labels are lowercase, Wikipedia titles are not. */
function display(name: string): string {
  const plain = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return plain.charAt(0).toUpperCase() + plain.slice(1);
}

const LATIN = /^[\p{Script=Latin}\p{N}\s'’.,&-]+$/u;

/** Drops Wikidata noise: codes, formulas, long archaic or translated titles, abbreviations. */
function usableAlias(form: string): boolean {
  return (
    LATIN.test(form) &&
    normalize(form).length >= 4 &&
    form.length <= 40 &&
    form.split(/\s+/).length <= 4 &&
    !/\d/.test(form) &&
    !/ſ/.test(form) &&
    !/^[A-Z.\s]+$/.test(form)
  );
}

export function mergePrompt(
  prompt: Prompt,
  items: WikiItem[],
  options: MergeOptions,
): { prompt: Prompt; report: MergeReport } {
  const report: MergeReport = {
    items: items.length,
    matched: 0,
    added: [],
    aliasesAdded: 0,
    rarityChanges: [],
    unmatched: [],
    clashes: [],
    tiered: false,
  };

  const byForm = new Map<string, WikiItem>();
  for (const item of items) {
    for (const form of [item.label, item.title, display(item.title), display(item.label), ...item.aliases]) {
      const key = normalize(form);
      if (key !== '' && !byForm.has(key)) byForm.set(key, item);
    }
  }

  const taken = new Map<string, string>();
  for (const answer of prompt.answers) {
    for (const form of [answer.canonical, ...(answer.aliases ?? [])]) taken.set(normalize(form), answer.canonical);
  }
  for (const wrong of prompt.wrongAnswers ?? []) taken.set(normalize(wrong), `wrong:${wrong}`);

  const claimed = new Map<string, Answer>();
  const itemOf = new Map<Answer, WikiItem>();
  for (const answer of prompt.answers) {
    const item = [answer.canonical, ...(answer.aliases ?? [])]
      .map((form) => byForm.get(normalize(form)))
      .find((found) => found !== undefined && !claimed.has(found.id));
    if (item) {
      claimed.set(item.id, answer);
      itemOf.set(answer, item);
    } else {
      report.unmatched.push(answer.canonical);
    }
  }
  report.matched = itemOf.size;

  const answers: Answer[] = prompt.answers.map((a) => ({ ...a, aliases: a.aliases ? [...a.aliases] : undefined }));
  const cloneOf = new Map(prompt.answers.map((a, i) => [a, answers[i]]));
  const itemOfClone = new Map([...itemOf].map(([a, item]) => [cloneOf.get(a)!, item]));

  for (const item of items) {
    if (claimed.has(item.id)) continue;
    const name = [display(item.title), display(item.label)].find((form) => !taken.has(normalize(form)));
    if (name === undefined) {
      report.clashes.push(item.label);
      continue;
    }
    taken.set(normalize(name), name);
    const answer: Answer = { canonical: name, rarity: 5 };
    answers.push(answer);
    itemOfClone.set(answer, item);
    report.added.push(name);
  }

  for (const answer of answers) {
    const item = itemOfClone.get(answer);
    if (!item) continue;
    const have = answer.aliases ?? [];
    for (const form of [item.label, item.title, ...item.aliases, ...item.labels]) {
      if (have.length >= options.maxAliases) break;
      const key = normalize(form);
      if (!usableAlias(form) || taken.has(key)) continue;
      taken.set(key, answer.canonical);
      have.push(form);
      report.aliasesAdded++;
    }
    if (have.length > 0) answer.aliases = have;
  }

  const ranked = [...itemOfClone].map(([answer, item]) => ({ key: answer.canonical, views: item.views }));
  if (ranked.length >= 5) {
    report.tiered = true;
    const tiers = assignTiers(ranked);
    for (const answer of answers) {
      const auto = tiers.get(answer.canonical);
      const next = options.pins[answer.canonical] ?? auto;
      if (next === undefined) continue;
      const isNew = report.added.includes(answer.canonical);
      if (!isNew && !options.updateRarity) continue;
      if (!isNew && answer.rarity !== next) {
        report.rarityChanges.push({ canonical: answer.canonical, from: answer.rarity, to: next });
      }
      answer.rarity = next;
    }
  }

  const order = new Map(answers.map((a, i) => [a, i]));
  const views = (a: Answer) => itemOfClone.get(a)?.views ?? -1;
  answers.sort((a, b) => a.rarity - b.rarity || views(b) - views(a) || order.get(a)! - order.get(b)!);

  return { prompt: { ...prompt, answers: answers.map(orderKeys) }, report };
}

function orderKeys(answer: Answer): Answer {
  return answer.aliases
    ? { canonical: answer.canonical, aliases: answer.aliases, rarity: answer.rarity }
    : { canonical: answer.canonical, rarity: answer.rarity };
}
