import type { Answer, Prompt } from '../game/types';
import { editDistance, typoBudget } from './distance';
import { normalize } from './normalize';

export type MatchResult =
  | { kind: 'match'; answer: Answer; exact: boolean }
  | { kind: 'miss' };

interface Matcher {
  accepted: Map<string, Answer>;
  wrong: Set<string>;
}

const cache = new WeakMap<Prompt, Matcher>();

function matcherFor(prompt: Prompt): Matcher {
  let matcher = cache.get(prompt);
  if (!matcher) {
    const accepted = new Map<string, Answer>();
    for (const answer of prompt.answers) {
      for (const form of [answer.canonical, ...(answer.aliases ?? [])]) {
        accepted.set(normalize(form), answer);
      }
    }
    const wrong = new Set((prompt.wrongAnswers ?? []).map(normalize));
    matcher = { accepted, wrong };
    cache.set(prompt, matcher);
  }
  return matcher;
}

function digits(s: string): string {
  return s.replace(/\D/g, '');
}

/**
 * Matches player input against a prompt's accepted answers
 * (architecture "Answer Matching").
 */
export function matchAnswer(prompt: Prompt, input: string): MatchResult {
  const key = normalize(input);
  if (key === '') return { kind: 'miss' };

  const { accepted, wrong } = matcherFor(prompt);

  const exact = accepted.get(key);
  if (exact) return { kind: 'match', answer: exact, exact: true };
  if (wrong.has(key)) return { kind: 'miss' };

  let best: Answer | null = null;
  let bestDistance = Infinity;
  let ambiguous = false;

  for (const [candidate, answer] of accepted) {
    // Numbers must match exactly: "apollo 12" is not a typo of "apollo 11".
    if (digits(candidate) !== digits(key)) continue;
    const distance = editDistance(key, candidate);
    if (distance > typoBudget(candidate)) continue;
    if (distance < bestDistance) {
      best = answer;
      bestDistance = distance;
      ambiguous = false;
    } else if (distance === bestDistance && answer !== best) {
      ambiguous = true;
    }
  }

  if (!best || ambiguous) return { kind: 'miss' };

  // A known wrong answer at least as close as the best accepted one wins.
  for (const w of wrong) {
    if (editDistance(key, w) <= bestDistance) return { kind: 'miss' };
  }

  return { kind: 'match', answer: best, exact: false };
}
