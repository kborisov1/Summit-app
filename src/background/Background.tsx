import { useEffect, useRef, type RefObject } from 'react';
import type { Rarity } from '../game/types';
import { climbFx, HOLDING } from './climb';
import { CALM } from './climber';
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
   * The empty box in the UI the climber climbs in: its base near the
   * bottom edge, the legendary line near the top. The climber and its rock
   * face fade out while the box is not on the page.
   */
  climberAnchor?: RefObject<HTMLElement | null>;
  /** What the player is doing, so the climber can react to it. */
  cues?: ClimberCues;
}

export interface ClimberCues {
  typing: boolean;
  lowTime: boolean;
  /** Changes with every wrong answer. */
  missId: string | null;
}

const NO_CUES: ClimberCues = { typing: false, lowTime: false, missId: null };

/** How quickly the scene eases toward a new altitude without a climb, per second. */
const EASE_RATE = 1.6;
/** The scene is soft, so rendering beyond this pixel density only costs fill rate. */
const MAX_DPR = 1.5;
/** How much faster the wind runs at full rush. */
const RUSH_WIND = 6;
/** How quickly the climber fades in or out, per second. */
const FADE_RATE = 3;
/** How quickly the climber's mood follows the player, per second. */
const MOOD_RATE = 4;

/**
 * Full-screen canvas behind the UI. The loop reads progress from a ref so
 * frames are not tied to React renders (architecture "Rendering").
 */
export function Background({ progress, climb = null, climberAnchor, cues = NO_CUES }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(progress);
  const climbRef = useRef(climb);
  const anchorRef = useRef(climberAnchor);
  const cuesRef = useRef(cues);
  const wakeRef = useRef<() => void>(() => {});

  // Runs after every render, so the loop also wakes when the climber's box mounts.
  useEffect(() => {
    targetRef.current = progress;
    climbRef.current = climb;
    anchorRef.current = climberAnchor;
    cuesRef.current = cues;
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
    let active: { rarity: Rarity | null; from: number; start: number; scrolled: number } | null = null;
    // The climbing area, how visible it is, and how far its face has scrolled, in rooms.
    let area: { x: number; base: number; size: number; room: number } | null = null;
    let presence = 0;
    let scrolled = 0;
    // The climber's mood.
    let look = 0;
    let tension = 0;
    let seenMissId = cuesRef.current.missId;
    let missAt = -Infinity;
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
        active = { rarity: event.rarity, from: shown, start: time, scrolled };
      }
      const cue = cuesRef.current;
      if (cue.missId !== seenMissId) {
        seenMissId = cue.missId;
        if (cue.missId !== null) missAt = time;
      }

      const anchor = anchorRef.current?.current;
      if (anchor?.isConnected) area = climbingArea(anchor.getBoundingClientRect());
      const wanted = anchor?.isConnected ? 1 : 0;

      let fx = null;
      if (reducedMotion) {
        shown = target;
        active = null;
        presence = wanted;
      } else {
        time += dt;
        presence = approach(presence, wanted, dt * FADE_RATE);
        look = approach(look, cue.typing ? 1 : 0, dt * MOOD_RATE);
        tension = approach(tension, cue.lowTime ? 1 : 0, dt * MOOD_RATE * 0.5);
        if (active) {
          fx = climbFx(active.rarity, time - active.start);
          shown = active.from + (target - active.from) * fx.travel;
          scrolled = active.scrolled + fx.scroll;
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
        wall: area && {
          x: area.x,
          base: area.base,
          size: area.size,
          room: area.room,
          scrolled,
          alpha: presence,
          lines: fx && active?.rarity ? { rarity: active.rarity, alpha: fx.lines, lit: fx.lit, scroll: fx.scroll } : null,
        },
        climber: area && {
          x: area.x,
          y: area.base - ((fx?.rise ?? 0) - (fx?.scroll ?? 0)) * area.room,
          size: area.size,
          alpha: presence,
          pose: fx ?? HOLDING,
          mood: reducedMotion ? CALM : { look, tension, sinceMiss: time - missAt },
        },
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

/** The climber's size, base line and climbing room inside the UI's box. */
function climbingArea(box: DOMRect) {
  const size = Math.min(92, Math.max(44, box.height * 0.24));
  const base = box.bottom - size * 0.25;
  return { x: box.left + box.width / 2, base, size, room: Math.max(size * 0.8, base - box.top - size * 1.15) };
}

function approach(value: number, target: number, step: number): number {
  return value + Math.sign(target - value) * Math.min(Math.abs(target - value), step);
}
