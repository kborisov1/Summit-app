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
    status: finished ? 'finished' : 'playing',
  };
}

/**
 * Each prompt gets one attempt; a wrong answer or running out of time gains
 * nothing and moves on (scope "Core Mechanic"). Blank input is ignored and
 * does not use the attempt.
 */
export function runReducer(state: RunState, action: RunAction): RunState {
  const prompt = currentPrompt(state);
  if (!prompt) return state;

  switch (action.type) {
    case 'submit': {
      if (action.input.trim() === '') return state;

      const match = matchAnswer(prompt, action.input);
      const rarity = match.kind === 'match' ? match.answer.rarity : null;
      return advance(state, {
        promptId: prompt.id,
        input: action.input.trim(),
        answer: match.kind === 'match' ? match.answer.canonical : null,
        rarity,
        gain: gainFor(rarity),
      });
    }
    case 'timeout':
      return advance(state, { promptId: prompt.id, input: '', answer: null, rarity: null, gain: 0 });
  }
}
