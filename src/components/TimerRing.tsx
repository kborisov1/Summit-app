interface Props {
  remaining: number;
  total: number;
  low: boolean;
}

const SIZE = 52;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Seconds left in the centre, with a ring that drains clockwise as time runs out. */
export function TimerRing({ remaining, total, low }: Props) {
  const seconds = Math.ceil(remaining / 1000);
  return (
    <div className={low ? 'timer low' : 'timer'} role="timer" aria-label={`${seconds} seconds left`}>
      <svg className="timer__ring" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle className="timer__track" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE} />
        <circle
          className="timer__fill"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          // A negative offset drains the arc from twelve o'clock clockwise.
          strokeDashoffset={-CIRCUMFERENCE * (1 - remaining / total)}
        />
      </svg>
      <span className="timer__count" aria-hidden="true">
        {seconds}
      </span>
    </div>
  );
}
