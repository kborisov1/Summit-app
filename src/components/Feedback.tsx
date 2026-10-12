import type { PromptResult } from '../game/run';
import { RARITY_LABEL } from '../game/scoring';
import { formatMetres } from './format';

interface Props {
  result: PromptResult;
}

/** What the last answer earned. A miss costs nothing (scope "Success Criteria"). */
export function Feedback({ result }: Props) {
  if (result.answer === null || result.rarity === null) {
    return (
      <p className="feedback feedback--miss">
        “{result.input}” isn’t on the trail. No altitude gained.
      </p>
    );
  }
  return (
    <p className={`feedback tier-${result.rarity}`}>
      <strong>{result.answer}</strong> <span className="tier-badge">{RARITY_LABEL[result.rarity]}</span>{' '}
      <span className="gain">+{formatMetres(result.gain)}</span>
    </p>
  );
}
