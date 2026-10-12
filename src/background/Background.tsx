import { useEffect, useRef } from 'react';
import { drawScene } from './scene';

interface Props {
  /** 0 at the trailhead, 1 at the summit. */
  progress: number;
}

/** How quickly the scene eases toward a new altitude, per second. */
const EASE_RATE = 1.6;

/**
 * Full-screen canvas behind the UI. The loop reads progress from a ref so
 * frames are not tied to React renders (architecture "Rendering").
 */
export function Background({ progress }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(progress);
  const wakeRef = useRef<() => void>(() => {});

  useEffect(() => {
    targetRef.current = progress;
    wakeRef.current();
  }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery?.matches ?? false;
    let shown = targetRef.current;
    let time = 0;
    let last = performance.now();
    let frame = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const target = targetRef.current;
      if (reducedMotion) {
        shown = target;
      } else {
        time += dt;
        shown += (target - shown) * Math.min(1, dt * EASE_RATE);
      }
      drawScene(ctx, { width, height, progress: shown, time });
      // With reduced motion, frames are drawn only when something changes.
      if (!reducedMotion && !document.hidden) schedule();
    };

    const schedule = () => {
      if (frame === 0) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };

    const onResize = () => {
      resize();
      schedule();
    };
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        schedule();
      }
    };
    const onMotionChange = () => {
      reducedMotion = motionQuery?.matches ?? false;
      schedule();
    };

    resize();
    schedule();
    wakeRef.current = schedule;
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    motionQuery?.addEventListener('change', onMotionChange);

    return () => {
      cancelAnimationFrame(frame);
      wakeRef.current = () => {};
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery?.removeEventListener('change', onMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="background" aria-hidden="true" />;
}
