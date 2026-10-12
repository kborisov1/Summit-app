import type { PromptResult } from '../game/run';
import { RARITY_LABEL } from '../game/scoring';
import { formatMetres } from './format';

type Props = { result: PromptResult; miss?: never } | { miss: string; result?: never };

/** What the last answer earned. A miss costs nothing (scope "Success Criteria"). */
export function Feedback({ result, miss }: Props) {
  if (miss !== undefined) {
    return (
      <p className="feedback feedback--miss">
        “{miss}” isn’t on the trail. Try again.
      </p>
    );
  }
  if (result.input === '') {
    return <p className="feedback feedback--miss">Out of time. No altitude gained.</p>;
  }
  if (result.answer === null || result.rarity === null) return null;
  return (
    <p className={`feedback tier-${result.rarity}`}>
      <strong>{result.answer}</strong> <span className="tier-badge">{RARITY_LABEL[result.rarity]}</span>{' '}
      <span className="gain">+{formatMetres(result.gain)}</span>
    </p>
  );
}
