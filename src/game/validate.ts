import { normalize } from '../matching/normalize';
import { PROMPTS_PER_RUN } from './scoring';
import type { PromptSet } from './types';

/**
 * Checks a prompt set against the content rules in scope "Altitude Scoring"
 * and the data model in architecture "Content and Data Model".
 * Returns a list of human-readable problems; empty means valid.
 */
export function validateSet(set: PromptSet): string[] {
  const problems: string[] = [];
  const where = (promptId: string) => `${set.id}/${promptId}`;

  if (set.prompts.length !== PROMPTS_PER_RUN) {
    problems.push(`${set.id}: has ${set.prompts.length} prompts, expected ${PROMPTS_PER_RUN}`);
  }

  const promptIds = new Set<string>();
  for (const prompt of set.prompts) {
    if (promptIds.has(prompt.id)) problems.push(`${where(prompt.id)}: duplicate prompt id`);
    promptIds.add(prompt.id);

    if (!prompt.answers.some((a) => a.rarity === 5)) {
      problems.push(`${where(prompt.id)}: no legendary answer`);
    }

    const seen = new Map<string, string>();
    for (const answer of prompt.answers) {
      if (![1, 2, 3, 4, 5].includes(answer.rarity)) {
        problems.push(`${where(prompt.id)}: "${answer.canonical}" has invalid rarity ${answer.rarity}`);
      }
      for (const form of [answer.canonical, ...(answer.aliases ?? [])]) {
        const key = normalize(form);
        if (key === '') {
          problems.push(`${where(prompt.id)}: "${answer.canonical}" has an empty form`);
          continue;
        }
        const owner = seen.get(key);
        if (owner !== undefined && owner !== answer.canonical) {
          problems.push(`${where(prompt.id)}: "${form}" is used by both "${owner}" and "${answer.canonical}"`);
        }
        seen.set(key, answer.canonical);
      }
    }

    for (const wrong of prompt.wrongAnswers ?? []) {
      const owner = seen.get(normalize(wrong));
      if (owner !== undefined) {
        problems.push(`${where(prompt.id)}: wrong answer "${wrong}" is also accepted as "${owner}"`);
      }
    }
  }

  return problems;
}
