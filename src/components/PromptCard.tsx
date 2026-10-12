import { useId, useState, type FormEvent } from 'react';
import { PROMPT_TIME_LIMIT_MS } from '../game/run';
import type { Prompt } from '../game/types';
import { useCountdown } from './useCountdown';

const LOW_TIME_MS = 10_000;

interface Props {
  prompt: Prompt;
  number: number;
  total: number;
  onSubmit: (input: string) => void;
  onTimeout: () => void;
}

export function PromptCard({ prompt, number, total, onSubmit, onTimeout }: Props) {
  const [input, setInput] = useState('');
  const questionId = useId();
  const remaining = useCountdown(PROMPT_TIME_LIMIT_MS, onTimeout);
  const seconds = Math.ceil(remaining / 1000);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // A blank answer does not use the attempt (scope "Core Mechanic").
    if (input.trim() === '') return;
    onSubmit(input);
    // A wrong answer keeps this card mounted, so clear it for the next try.
    setInput('');
  };

  return (
    <form className="card prompt" onSubmit={handleSubmit}>
      <div className="prompt__meta">
        <p className="prompt__step">
          Step {number} of {total}
        </p>
        <span
          className={remaining <= LOW_TIME_MS ? 'prompt__clock low' : 'prompt__clock'}
          role="timer"
          aria-label={`${seconds} seconds left`}
        >
          {seconds}s
        </span>
      </div>
      <div className="prompt__timebar" aria-hidden="true">
        <div className="prompt__timefill" style={{ transform: `scaleX(${remaining / PROMPT_TIME_LIMIT_MS})` }} />
      </div>
      <h2 className="prompt__question" id={questionId}>
        {prompt.question}
      </h2>
      <div className="prompt__row">
        <input
          className="prompt__input"
          aria-labelledby={questionId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
