import type { CSSProperties } from 'react';
import { displayAltitude, SUMMIT_ALTITUDE } from '../game/scoring';
import { formatMetres } from './format';

interface Props {
  /** Raw altitude; the meter caps it at the summit. */
  altitude: number;
}

const MINOR_STEP = 1000;
const MAJOR_STEP = 2000;
/** The 8,000 m mark sits too close to the summit label, so it stays unlabelled. */
const UNLABELLED_MAJOR = 8000;

interface Tick {
  altitude: number;
  major: boolean;
  label?: string;
}

function buildTicks(): Tick[] {
  const ticks: Tick[] = [];
  for (let m = 0; m < SUMMIT_ALTITUDE; m += MINOR_STEP) {
    const major = m % MAJOR_STEP === 0;
    ticks.push({
      altitude: m,
      major,
      label: major && m !== UNLABELLED_MAJOR ? formatMetres(m) : undefined,
    });
  }
  ticks.push({ altitude: SUMMIT_ALTITUDE, major: true, label: formatMetres(SUMMIT_ALTITUDE) });
  return ticks;
}

const TICKS = buildTicks();

/** The main HUD element (scope "Experience"). */
export function AltitudeMeter({ altitude }: Props) {
  const shown = displayAltitude(altitude);
  const fraction = shown / SUMMIT_ALTITUDE;

  return (
    <div
      className="meter"
      role="meter"
      aria-label="Altitude"
      aria-valuemin={0}
      aria-valuemax={SUMMIT_ALTITUDE}
      aria-valuenow={shown}
      aria-valuetext={`${formatMetres(shown)} of ${formatMetres(SUMMIT_ALTITUDE)}`}
    >
      <div className="meter__scale" style={{ '--fill': fraction } as CSSProperties} aria-hidden="true">
        <div className="meter__track">
          <div className="meter__fill" />
        </div>
        {TICKS.map((tick) => (
          <div
            key={tick.altitude}
            className={tick.major ? 'meter__tick meter__tick--major' : 'meter__tick'}
            style={{ '--at': tick.altitude / SUMMIT_ALTITUDE } as CSSProperties}
          >
            {tick.label && <span className="meter__tick-label">{tick.label}</span>}
          </div>
        ))}
        <div className="meter__you">
          <span className="meter__you-label">You</span>
          <span className="meter__you-dot" />
        </div>
      </div>
    </div>
  );
}
