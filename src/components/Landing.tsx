import { useEffect, useRef, type CSSProperties, type Ref } from 'react';
import { climbArrival } from '../background/climb';
import type { PromptResult } from '../game/run';
import { RARITY_LABEL, RARITY_QUIP } from '../game/scoring';
import { formatMetres } from './format';

interface Props {
  result: PromptResult;
  /** The question just answered, which drifts away. */
  question: string;
  number: number;
  total: number;
  /** Whether this was the run's last prompt. */
  last: boolean;
  onContinue: () => void;
  /** The empty box the background draws the climber into, kept in place from the prompt. */
  climberRef?: Ref<HTMLDivElement>;
}

/**
 * Where an answer landed (scope "Experience"): the banner appears once the
 * climber arrives, and the next prompt waits for the player.
 */
export function Landing({ result, question, number, total, last, onContinue, climberRef }: Props) {
  const arrival = climbArrival(result.rarity) * 1000;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timedOut = result.rarity === null;

  // Focus the button once the climber arrives, so Enter carries on.
  useEffect(() => {
    const id = setTimeout(() => buttonRef.current?.focus(), arrival);
    return () => clearTimeout(id);
  }, [arrival]);

  const delay = { '--arrival': `${arrival}ms` } as CSSProperties;
  return (
    <section className="prompt landing" style={delay} aria-label="Climb result">
      <header className="prompt__head">
        <p className="prompt__step">
          Step {number} of {total}
        </p>
        <p className="prompt__question landing__gone" aria-hidden="true">
          {question}
        </p>
      </header>
      <div className="prompt__scene">
        <div className={timedOut ? 'landing__banner miss' : `landing__banner tier-${result.rarity}`} aria-live="polite">
          <h2 className="landing__tier">{timedOut ? 'Out of time' : RARITY_LABEL[result.rarity!]}</h2>
          {!timedOut && <p className="landing__answer">“{result.answer}”</p>}
          <p className="landing__gain">{timedOut ? 'No altitude gained' : `+${formatMetres(result.gain)}`}</p>
          <p className="landing__quip">{timedOut ? 'You held your ground.' : RARITY_QUIP[result.rarity!]}</p>
        </div>
        <div className="prompt__wall" ref={climberRef} aria-hidden="true" />
      </div>
      <div className="landing__bar">
        <button ref={buttonRef} type="button" className="button landing__next" onClick={onContinue}>
          {last ? 'See your climb' : 'Climb on ▲'}
        </button>
      </div>
    </section>
  );
}
