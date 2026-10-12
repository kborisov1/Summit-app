import { matchAnswer } from '../matching/match';
import { gainFor, hasReachedSummit } from './scoring';
import type { Prompt, PromptSet, Rarity } from './types';

export interface PromptResult {
  promptId: string;
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

export type RunAction = { type: 'submit'; input: string };

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

/**
 * Each prompt gets one attempt; a wrong answer gains nothing and moves on
 * (scope "Core Mechanic"). Blank input is ignored and does not use the attempt.
 */
export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'submit': {
      const prompt = currentPrompt(state);
      if (!prompt || action.input.trim() === '') return state;

      const match = matchAnswer(prompt, action.input);
      const rarity = match.kind === 'match' ? match.answer.rarity : null;
      const result: PromptResult = {
        promptId: prompt.id,
        input: action.input.trim(),
        answer: match.kind === 'match' ? match.answer.canonical : null,
        rarity,
        gain: gainFor(rarity),
      };

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
  }
}
