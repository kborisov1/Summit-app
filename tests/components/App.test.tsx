import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/components/App';
import { PROMPT_TIME_LIMIT_MS } from '../../src/game/run';
import type { Prompt, PromptSet } from '../../src/game/types';
import { loadProgress, STORAGE_KEY, type KeyValueStore } from '../../src/storage/progress';

function makePrompt(n: number): Prompt {
  return {
    id: `p${n}`,
    question: `Question ${n}?`,
    answers: [
      { canonical: 'Common', rarity: 1 },
      { canonical: 'Rare', rarity: 3 },
      { canonical: 'Legendary', rarity: 5 },
    ],
  };
}

const set: PromptSet = { id: 'test', prompts: Array.from({ length: 7 }, (_, i) => makePrompt(i)) };
const now = new Date(2026, 9, 12, 9, 0);

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

function renderApp(store = memoryStore(), skipStart = false) {
  render(<App sets={[set]} now={now} store={store} />);
  if (!skipStart) fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  return store;
}

function answer(text: string) {
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Climb' }));
}

const meterValue = () => screen.getByRole('meter', { name: 'Altitude' }).getAttribute('aria-valuenow');

describe('App run flow', () => {
  it('starts on the first prompt at zero altitude', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'Question 0?' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 7')).toBeInTheDocument();
    expect(meterValue()).toBe('0');
  });

  it('gains altitude for a match and shows the tier', () => {
    renderApp();
    answer('legendry');
    expect(meterValue()).toBe('1400');
    expect(screen.getByText('Legendary', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Question 1?' })).toBeInTheDocument();
  });

  it('moves on without altitude after a wrong answer', () => {
    renderApp();
    answer('banana');
    expect(meterValue()).toBe('0');
    expect(screen.getByText(/isn’t on the trail/)).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 7')).toBeInTheDocument();
  });

  it('ignores a blank answer', () => {
    renderApp();
    answer('   ');
    expect(screen.getByText('Step 1 of 7')).toBeInTheDocument();
  });

  it('shows results and saves progress after the last prompt', () => {
    const store = renderApp();
    for (let i = 0; i < 6; i++) answer('Legendary');
    answer('Rare');

    expect(screen.getByRole('heading', { name: 'You reached the summit' })).toBeInTheDocument();
    expect(meterValue()).toBe('8848');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    const saved = loadProgress(store);
    expect(saved.results['2026-10-12']).toMatchObject({ setId: 'test', altitude: 9050, reachedSummit: true });
    expect(saved.streak).toBe(1);
  });

  it('shows today’s result when the run was already played', () => {
    const first = renderApp();
    for (let i = 0; i < 7; i++) answer('Common');
    cleanup();

    renderApp(memoryStore({ [STORAGE_KEY]: first.data[STORAGE_KEY] }), true);
    expect(screen.getByRole('heading', { name: 'You climbed to 910 m' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('App prompt timer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  it('counts down from 30 seconds', () => {
    vi.useFakeTimers();
    renderApp();
    expect(screen.getByRole('timer')).toHaveTextContent('30s');
    advance(10_000);
    expect(screen.getByRole('timer')).toHaveTextContent('20s');
  });

  it('moves on with no altitude when time runs out, ignoring unsubmitted text', () => {
    vi.useFakeTimers();
    renderApp();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Legendary' } });
    advance(PROMPT_TIME_LIMIT_MS);

    expect(meterValue()).toBe('0');
    expect(screen.getByText('Out of time. No altitude gained.')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 7')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('restarts the clock for each prompt', () => {
    vi.useFakeTimers();
    renderApp();
    advance(20_000);
    answer('Rare');
    expect(screen.getByRole('timer')).toHaveTextContent('30s');
    advance(PROMPT_TIME_LIMIT_MS - 1_000);
    expect(screen.getByText('Step 2 of 7')).toBeInTheDocument();
  });

  it('shows timed-out prompts on the result screen', () => {
    vi.useFakeTimers();
    renderApp();
    for (let i = 0; i < 7; i++) advance(PROMPT_TIME_LIMIT_MS);

    expect(screen.getByRole('heading', { name: 'You climbed to 0 m' })).toBeInTheDocument();
    expect(screen.getAllByText(/Out of time/)).toHaveLength(7);
  });
});
