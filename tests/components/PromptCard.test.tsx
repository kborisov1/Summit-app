import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PromptCard } from '../../src/components/PromptCard';
import { PROMPT_TIME_LIMIT_MS } from '../../src/game/run';

const prompt = { id: 'p', question: 'Question?', answers: [{ canonical: 'Answer', rarity: 1 as const }] };

function renderCard(props: Partial<Parameters<typeof PromptCard>[0]> = {}) {
  return render(<PromptCard prompt={prompt} number={1} total={7} onSubmit={() => {}} onTimeout={() => {}} {...props} />);
}

describe('PromptCard climber cues', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports when the player is typing, ignoring blank text', () => {
    const onTypingChange = vi.fn();
    renderCard({ onTypingChange });
    expect(onTypingChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  ' } });
    expect(onTypingChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ans' } });
    expect(onTypingChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Climb' }));
    expect(onTypingChange).toHaveBeenLastCalledWith(false);
  });

  it('reports each keystroke, so the climber can nod along', () => {
    const onKeystroke = vi.fn();
    renderCard({ onKeystroke });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A' } });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'An' } });
    expect(onKeystroke).toHaveBeenCalledTimes(2);
  });

  it('reports when time runs low, and clears both cues on unmount', () => {
    vi.useFakeTimers();
    const onLowTimeChange = vi.fn();
    const onTypingChange = vi.fn();
    const { unmount } = renderCard({ onLowTimeChange, onTypingChange });
    expect(onLowTimeChange).toHaveBeenLastCalledWith(false);
    act(() => {
      vi.advanceTimersByTime(PROMPT_TIME_LIMIT_MS - 9_000);
    });
    expect(onLowTimeChange).toHaveBeenLastCalledWith(true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ans' } });
    unmount();
    expect(onLowTimeChange).toHaveBeenLastCalledWith(false);
    expect(onTypingChange).toHaveBeenLastCalledWith(false);
  });
});
