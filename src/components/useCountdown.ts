import { useEffect, useRef, useState } from 'react';

const TICK_MS = 250;

/**
 * Counts down from `durationMs` starting at mount and calls `onExpire` once
 * when time runs out. Returns the milliseconds left. Remaining time is taken
 * from the wall clock, so a throttled or hidden tab does not stretch it.
 */
export function useCountdown(durationMs: number, onExpire: () => void): number {
  const [remaining, setRemaining] = useState(durationMs);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    const deadline = Date.now() + durationMs;
    const id = setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left === 0) {
        clearInterval(id);
        onExpireRef.current();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [durationMs]);

  return remaining;
}
