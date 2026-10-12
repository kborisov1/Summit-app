import { useEffect, useRef, type RefObject } from 'react';
import type { Rarity } from '../game/types';
import { climbFx, STANDING } from './climb';
import { strideLength } from './climber';
import { drawScene } from './scene';

/** One answer's climb; a new `id` starts a new camera move. */
export interface ClimbEvent {
  id: number;
  /** Null for a wrong answer or a timeout. */
  rarity: Rarity | null;
}

interface Props {
  /** 0 at the trailhead, 1 at the summit. */
  progress: number;
  climb?: ClimbEvent | null;
  /**
   * The empty box in the UI where the climber stands, feet at its bottom
   * edge. The climber fades out while the box is not on the page.
   */
  climberAnchor?: RefObject<HTMLElement | null>;
}

/** How quickly the scene eases toward a new altitude without a climb, per second. */
const EASE_RATE = 1.6;
/** The scene is soft, so rendering beyond this pixel density only costs fill rate. */
const MAX_DPR = 1.5;
/** How much faster the wind runs at full rush. */
const RUSH_WIND = 6;
/** How quickly the climber fades in or out, per second. */
const FADE_RATE = 3;

/**
 * Full-screen canvas behind the UI. The loop reads progress from a ref so
 * frames are not tied to React renders (architecture "Rendering").
 */
export function Background({ progress, climb = null, climberAnchor }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(progress);
  const climbRef = useRef(climb);
  const anchorRef = useRef(climberAnchor);
  const wakeRef = useRef<() => void>(() => {});

  // Runs after every render, so the loop also wakes when the climber's box mounts.
  useEffect(() => {
    targetRef.current = progress;
    climbRef.current = climb;
    anchorRef.current = climberAnchor;
    wakeRef.current();
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery?.matches ?? false;
    let shown = targetRef.current;
    let time = 0;
    let wind = 0;
    // The climb in progress: where it started and when.
    let seenClimbId = climbRef.current?.id ?? null;
    let active: { rarity: Rarity | null; from: number; start: number; ground: number } | null = null;
    // The climber: where it stands, how visible it is, and how far the ledge has scrolled.
    let spot: { x: number; y: number; size: number } | null = null;
    let presence = 0;
    let ground = 0;
    let last = performance.now();
    let frame = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
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
      const event = climbRef.current;
      if (event && event.id !== seenClimbId) {
        seenClimbId = event.id;
        active = { rarity: event.rarity, from: shown, start: time, ground };
      }

      const anchor = anchorRef.current?.current;
      if (anchor?.isConnected) {
        const box = anchor.getBoundingClientRect();
        spot = { x: box.left + box.width / 2, y: box.bottom, size: box.height };
      }
      const wanted = anchor?.isConnected ? 1 : 0;

      let fx = null;
      if (reducedMotion) {
        shown = target;
        active = null;
        presence = wanted;
      } else {
        time += dt;
        presence += Math.sign(wanted - presence) * Math.min(Math.abs(wanted - presence), dt * FADE_RATE);
        if (active) {
          fx = climbFx(active.rarity, time - active.start);
          shown = active.from + (target - active.from) * fx.travel;
          ground = active.ground + fx.distance * strideLength(fx.gait);
          if (fx.done) active = null;
        } else {
          shown += (target - shown) * Math.min(1, dt * EASE_RATE);
        }
        wind += dt * (1 + RUSH_WIND * (fx?.rush ?? 0));
      }
      drawScene(ctx, {
        width,
        height,
        progress: shown,
        time,
        wind,
        bob: fx?.bob,
        shake: fx?.shake,
        rush: fx?.rush,
        flash: fx?.flash,
        climber: spot && { ...spot, alpha: presence, ground, pose: fx ?? STANDING },
      });
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
