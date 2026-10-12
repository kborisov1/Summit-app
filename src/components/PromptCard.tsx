import { useEffect, useId, useState, type FormEvent, type ReactNode, type Ref } from 'react';
import { PROMPT_TIME_LIMIT_MS } from '../game/run';
import type { Prompt } from '../game/types';
import { TimerRing } from './TimerRing';
import { useCountdown } from './useCountdown';

const LOW_TIME_MS = 10_000;

interface Props {
  prompt: Prompt;
  number: number;
  total: number;
  onSubmit: (input: string) => void;
  onTimeout: () => void;
  /** A short note just above the answer bar, such as a wrong answer. */
  notice?: ReactNode;
  /** The empty box the background draws the climber and its rock face into. */
  climberRef?: Ref<HTMLDivElement>;
  /** Told whether there is text in the field, so the climber can look up. */
  onTypingChange?: (typing: boolean) => void;
  /** Told when time starts running low, so the climber can grow restless. */
  onLowTimeChange?: (low: boolean) => void;
}

/** The question at the top, the climber in the middle, the answer bar at the bottom. */
export function PromptCard({
  prompt,
  number,
  total,
  onSubmit,
  onTimeout,
  notice,
  climberRef,
  onTypingChange,
  onLowTimeChange,
}: Props) {
  const [input, setInput] = useState('');
  const questionId = useId();
  const remaining = useCountdown(PROMPT_TIME_LIMIT_MS, onTimeout);
  const low = remaining <= LOW_TIME_MS;
  const typing = input.trim() !== '';

  useEffect(() => {
    onTypingChange?.(typing);
    return () => onTypingChange?.(false);
  }, [typing, onTypingChange]);

  useEffect(() => {
    onLowTimeChange?.(low);
    return () => onLowTimeChange?.(false);
  }, [low, onLowTimeChange]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // A blank answer does not use the attempt (scope "Core Mechanic").
    if (input.trim() === '') return;
    onSubmit(input);
    // A wrong answer keeps this card mounted, so clear it for the next try.
    setInput('');
  };

  return (
    <form className="prompt" onSubmit={handleSubmit}>
      <header className="prompt__head">
        <p className="prompt__step">
          Step {number} of {total}
        </p>
        <h2 className="prompt__question" id={questionId}>
          {prompt.question}
        </h2>
      </header>
      <div className="prompt__scene">
        <div className="prompt__wall" ref={climberRef} aria-hidden="true" />
      </div>
      <div className="notice-slot" aria-live="polite">
        {notice}
      </div>
      <div className="prompt__bar">
        <TimerRing remaining={remaining} total={PROMPT_TIME_LIMIT_MS} low={low} />
        <input
          className="prompt__input"
          aria-labelledby={questionId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Your answer"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
        />
        <button className="button" type="submit">
          Climb
        </button>
      </div>
    </form>
  );
}
