import { SUMMIT_ALTITUDE } from '../game/scoring';
import { formatMetres } from './format';

interface Props {
  onStart: () => void;
}

export function StartScreen({ onStart }: Props) {
  return (
    <section className="start" aria-labelledby="start-title">
      <p className="start__eyebrow">A daily climb</p>
      <h2 id="start-title" className="start__title">
        Climb the mountain
      </h2>
      <svg className="start__ridge" viewBox="0 0 150 22" aria-hidden="true">
        <path d="M2 19 C18 17 24 9 34 8 C44 7 48 15 58 12 C70 8 76 2 86 3 C98 4 100 13 112 14 C126 15 136 18 148 19" />
      </svg>
      <p className="start__text">
        Answer with the first thing that comes to mind. The rarer your answer, the higher you climb.
      </p>
      <ul className="start__facts">
        <li>
          <strong>7</strong>
          <span>questions</span>
        </li>
        <li>
          <strong>30 s</strong>
          <span>for each</span>
        </li>
        <li>
          <strong>{formatMetres(SUMMIT_ALTITUDE)}</strong>
          <span>to the summit</span>
        </li>
      </ul>
      <button type="button" className="button start__button" onClick={onStart} autoFocus>
        Start
      </button>
    </section>
  );
}
