import { describe, expect, it } from 'vitest';
import { createRun, currentPrompt, runReducer, type RunState } from '../../src/game/run';
import { displayAltitude, SUMMIT_ALTITUDE } from '../../src/game/scoring';
import type { Prompt, PromptSet } from '../../src/game/types';

function makePrompt(n: number): Prompt {
  return {
    id: `p${n}`,
    question: `Question ${n}`,
    answers: [
      { canonical: 'common', rarity: 1 },
      { canonical: 'rare', rarity: 3 },
      { canonical: 'legendary', rarity: 5 },
    ],
  };
}

const set: PromptSet = { id: 'test', prompts: Array.from({ length: 7 }, (_, i) => makePrompt(i)) };

function play(inputs: string[]): RunState {
  return inputs.reduce((s, input) => runReducer(s, { type: 'submit', input }), createRun(set));
}

describe('run reducer', () => {
  it('starts at the first prompt with no altitude', () => {
    const state = createRun(set);
    expect(state.status).toBe('playing');
    expect(state.altitude).toBe(0);
    expect(currentPrompt(state)?.id).toBe('p0');
  });

  it('adds the gain for a matched answer and moves on', () => {
    const state = play(['rare']);
    expect(state.altitude).toBe(650);
    expect(state.promptIndex).toBe(1);
    expect(state.results[0]).toEqual({
      promptId: 'p0',
      input: 'rare',
      answer: 'rare',
      rarity: 3,
      gain: 650,
    });
  });

  it('stays on the prompt with no gain after a wrong answer, allowing unlimited retries', () => {
    let state = play(['nope', 'nada', 'still no']);
    expect(state.altitude).toBe(0);
    expect(state.promptIndex).toBe(0);
    expect(state.results).toHaveLength(0);
    expect(state.miss).toEqual({ input: 'still no', count: 3 });

    state = runReducer(state, { type: 'submit', input: 'rare' });
    expect(state.promptIndex).toBe(1);
    expect(state.miss).toBeNull();
    expect(state.results[0]).toMatchObject({ answer: 'rare', gain: 650 });
  });

  it('still moves on at timeout after wrong answers', () => {
    const state = runReducer(play(['nope']), { type: 'timeout' });
    expect(state.promptIndex).toBe(1);
    expect(state.miss).toBeNull();
    expect(state.results[0]).toMatchObject({ input: '', gain: 0 });
  });

  it('ignores blank input without using the attempt', () => {
    const before = createRun(set);
    expect(runReducer(before, { type: 'submit', input: '   ' })).toBe(before);
  });

  it('moves on with no gain when the prompt times out', () => {
    const state = runReducer(createRun(set), { type: 'timeout' });
    expect(state.altitude).toBe(0);
    expect(state.promptIndex).toBe(1);
    expect(state.results[0]).toEqual({ promptId: 'p0', input: '', answer: null, rarity: null, gain: 0 });
  });

  it('finishes when the last prompt times out', () => {
    const state = runReducer(play(Array(6).fill('common')), { type: 'timeout' });
    expect(state.status).toBe('finished');
    expect(state.altitude).toBe(780);
    expect(runReducer(state, { type: 'timeout' })).toBe(state);
  });

  it('finishes after the last prompt', () => {
    const state = play(Array(7).fill('common'));
    expect(state.status).toBe('finished');
    expect(state.altitude).toBe(910);
    expect(currentPrompt(state)).toBeNull();
    expect(runReducer(state, { type: 'submit', input: 'common' })).toBe(state);
  });

  it('reaches the summit on the final prompt of a near-perfect run', () => {
    const sixLegendary = play(Array(6).fill('legendary'));
    expect(sixLegendary.status).toBe('playing');

    const done = runReducer(sixLegendary, { type: 'submit', input: 'rare' });
    expect(done.status).toBe('finished');
    expect(done.altitude).toBe(9050);
    expect(displayAltitude(done.altitude)).toBe(SUMMIT_ALTITUDE);
  });
});
