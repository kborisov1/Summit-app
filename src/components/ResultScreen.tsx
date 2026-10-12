import { displayAltitude, gainFor, RARITY_LABEL } from '../game/scoring';
import type { Prompt } from '../game/types';
import type { DayResult } from '../storage/progress';
import { formatMetres } from './format';

interface Props {
  result: DayResult;
  prompts: readonly Prompt[];
  streak: number;
}

export function ResultScreen({ result, prompts, streak }: Props) {
  const questions = new Map(prompts.map((p) => [p.id, p.question]));

  return (
    <section className="card result" aria-labelledby="result-title">
      <h2 id="result-title" className="result__title">
        {result.reachedSummit ? 'You reached the summit' : `You climbed to ${formatMetres(displayAltitude(result.altitude))}`}
      </h2>
      <p className="result__streak">
        {streak === 1 ? '1 day' : `${streak} days`} in a row
      </p>
      <ol className="result__list">
        {result.answers.map((a) => (
          <li key={a.promptId} className={a.rarity === null ? 'result__item miss' : `result__item tier-${a.rarity}`}>
            <span className="result__question">{questions.get(a.promptId) ?? a.promptId}</span>
            <span className="result__answer">
              {a.answer ?? (a.input === '' ? 'Out of time' : a.input)}
              {a.rarity !== null ? (
                <>
                  {' '}
                  <span className="tier-badge">{RARITY_LABEL[a.rarity]}</span>{' '}
                  <span className="gain">+{formatMetres(gainFor(a.rarity))}</span>
                </>
              ) : (
                <> · no altitude</>
              )}
            </span>
          </li>
        ))}
      </ol>
      <p className="result__next">A new climb opens tomorrow.</p>
    </section>
  );
}
