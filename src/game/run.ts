import { matchAnswer } from '../matching/match';
import { gainFor, hasReachedSummit } from './scoring';
import type { Prompt, PromptSet, Rarity } from './types';

/** Time allowed for each prompt (scope "Core Mechanic"). */
export const PROMPT_TIME_LIMIT_MS = 30_000;

export interface PromptResult {
  promptId: string;
  /** What the player submitted, or '' when the prompt timed out. */
  input: string;
  /** Canonical form of the matched answer, or null for a wrong answer. */
  answer: string | null;
  rarity: Rarity | null;
  gain: number;
}

export interface RunState {
  setId: string;
  prompts: readonly Prompt[];
  promptIndex: number;
  /** Raw altitude; use `displayAltitude` for the HUD. */
  altitude: number;
  results: PromptResult[];
  /** The latest wrong guess on the current prompt; `count` increases with each one. */
  miss: { input: string; count: number } | null;
  status: 'playing' | 'finished';
}

export type RunAction = { type: 'submit'; input: string } | { type: 'timeout' };

export function createRun(set: PromptSet): RunState {
  return {
    setId: set.id,
    prompts: set.prompts,
    promptIndex: 0,
    altitude: 0,
    results: [],
    miss: null,
    status: set.prompts.length === 0 ? 'finished' : 'playing',
  };
}

export function currentPrompt(state: RunState): Prompt | null {
  return state.status === 'playing' ? state.prompts[state.promptIndex] : null;
}

function advance(state: RunState, result: PromptResult): RunState {
  const altitude = state.altitude + result.gain;
  const promptIndex = state.promptIndex + 1;
  const finished = promptIndex >= state.prompts.length || hasReachedSummit(altitude);

  return {
    ...state,
    promptIndex,
    altitude,
    results: [...state.results, result],
    miss: null,
    status: finished ? 'finished' : 'playing',
  };
}

/**
 * A wrong answer gains nothing and keeps the player on the same prompt, with
 * unlimited retries until the timer expires; running out of time gains nothing
 * and moves on (scope "Core Mechanic"). Blank input is ignored.
 */
export function runReducer(state: RunState, action: RunAction): RunState {
  const prompt = currentPrompt(state);
  if (!prompt) return state;

  switch (action.type) {
    case 'submit': {
      if (action.input.trim() === '') return state;

      const match = matchAnswer(prompt, action.input);
      if (match.kind !== 'match') {
        return { ...state, miss: { input: action.input.trim(), count: (state.miss?.count ?? 0) + 1 } };
      }
      return advance(state, {
        promptId: prompt.id,
        input: action.input.trim(),
        answer: match.answer.canonical,
        rarity: match.answer.rarity,
        gain: gainFor(match.answer.rarity),
      });
    }
    case 'timeout':
      return advance(state, { promptId: prompt.id, input: '', answer: null, rarity: null, gain: 0 });
  }
}
