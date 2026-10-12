import type { CSSProperties } from 'react';
import { displayAltitude, SUMMIT_ALTITUDE } from '../game/scoring';
import { formatMetres } from './format';

interface Props {
  /** Raw altitude; the meter caps it at the summit. */
  altitude: number;
}

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
      <div className="meter__readout">
        <span className="meter__value">{formatMetres(shown)}</span>
        <span className="meter__summit">Summit {formatMetres(SUMMIT_ALTITUDE)}</span>
      </div>
      <div className="meter__track" aria-hidden="true">
        <div className="meter__fill" style={{ '--fill': fraction } as CSSProperties} />
      </div>
    </div>
  );
}
