import { useId, useState, type FormEvent } from 'react';
import type { Prompt } from '../game/types';

interface Props {
  prompt: Prompt;
  number: number;
  total: number;
  onSubmit: (input: string) => void;
}

export function PromptCard({ prompt, number, total, onSubmit }: Props) {
  const [input, setInput] = useState('');
  const questionId = useId();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // A blank answer does not use the attempt (scope "Core Mechanic").
    if (input.trim() === '') return;
    onSubmit(input);
  };

  return (
    <form className="card prompt" onSubmit={handleSubmit}>
      <p className="prompt__step">
        Step {number} of {total}
      </p>
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
