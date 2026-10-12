import { useEffect, useRef, type RefObject } from 'react';
import { LANDMARKS } from '../game/landmarks';
import { RARITY_GAIN, SUMMIT_ALTITUDE } from '../game/scoring';
import type { Rarity } from '../game/types';
import { climbFx, STANDING } from './climb';
import { CALM } from './climber';
import type { Landing } from './markers';
import { drawScene } from './scene';

/** One answer's climb; a new `id` starts a new climb. */
export interface ClimbEvent {
  id: number;
  /** Null for a timeout. */
  rarity: Rarity | null;
  /** What the player typed, shown riding above the runner. */
  answer: string;
}

interface Props {
  /** Raw altitude in metres; the scenery tops out at the summit. */
  altitude: number;
  climb?: ClimbEvent | null;
  /** Where earlier answers landed, marked on the mountain. */
  landings?: readonly Landing[];
  /**
   * The empty box in the UI the runner climbs in, its base near the bottom
   * edge. The runner and the mountain's markers fade out while the box is
   * not on the page.
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
const NO_LANDINGS: readonly Landing[] = [];

/** How quickly the camera eases toward a new altitude without a climb, per second. */
const EASE_RATE = 1.6;
/** The scene is soft, so rendering beyond this pixel density only costs fill rate. */
const MAX_DPR = 1.5;
/** How much faster the wind runs at full rush. */
const RUSH_WIND = 6;
/** How quickly the climber fades in or out, per second. */
const FADE_RATE = 3;
/** How quickly the climber's mood follows the player, per second. */
const MOOD_RATE = 4;
/** Metres of mountain that fit in one screen height. */
const METRES_PER_SCREEN = 1150;

/**
 * Full-screen canvas behind the UI. The loop reads its inputs from refs so
 * frames are not tied to React renders (architecture "Rendering").
 */
export function Background({ altitude, climb = null, landings = NO_LANDINGS, climberAnchor, cues = NO_CUES }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(altitude);
  const climbRef = useRef(climb);
  const landingsRef = useRef(landings);
  const anchorRef = useRef(climberAnchor);
  const cuesRef = useRef(cues);
  const wakeRef = useRef<() => void>(() => {});

  // Runs after every render, so the loop also wakes when the climber's box mounts.
  useEffect(() => {
    targetRef.current = altitude;
    climbRef.current = climb;
    landingsRef.current = landings;
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
    // The camera's altitude, in metres.
    let camera = targetRef.current;
    let time = 0;
    let wind = 0;
    // The climb in progress: where it runs from and to, and when it began.
    let seenClimbId = climbRef.current?.id ?? null;
    let active: { event: ClimbEvent; from: number; to: number; start: number } | null = null;
    // The climbing area and how visible it is.
    let area: { x: number; base: number; size: number; room: number } | null = null;
    let presence = 0;
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
        active = { event, from: camera, to: target, start: time };
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
        camera = target;
        active = null;
        presence = wanted;
      } else {
        time += dt;
        presence = approach(presence, wanted, dt * FADE_RATE);
        look = approach(look, cue.typing ? 1 : 0, dt * MOOD_RATE);
        tension = approach(tension, cue.lowTime ? 1 : 0, dt * MOOD_RATE * 0.5);
        if (active) {
          fx = climbFx(active.event.rarity, time - active.start);
          camera = active.from + (active.to - active.from) * fx.travel;
          if (fx.done) active = null;
        } else {
          camera += (target - camera) * Math.min(1, dt * EASE_RATE);
        }
        wind += dt * (1 + RUSH_WIND * (fx?.rush ?? 0));
      }

      const pxPerMetre = height / METRES_PER_SCREEN;
      // Mid-climb the runner pulls ahead of the camera, up the screen, then
      // the camera catches up as it arrives.
      const lead =
        area && active && fx ? fx.lead * Math.min(area.room * 0.45, (active.to - active.from) * pxPerMetre * 0.3) : 0;
      const climberY = area ? area.base - lead : 0;
      // Half the runner's lane: facts and pennants sit either side of it.
      const half = area ? Math.min(width * 0.3, Math.max(area.size * 1.3, 70)) : 0;

      drawScene(ctx, {
        width,
        height,
        progress: Math.min(1, camera / SUMMIT_ALTITUDE),
        time,
        wind,
        bob: fx?.bob,
        shake: fx?.shake,
        rush: fx?.rush,
        flash: fx?.flash,
        markers: area && {
          x: area.x,
          half,
          base: area.base,
          camera,
          pxPerMetre,
          alpha: presence,
          landmarks: LANDMARKS,
          landings: landingsRef.current,
          lines:
            active && fx && active.event.rarity
              ? {
                  // Lines hang from where this answer's climb truly starts, even if
                  // the camera had not quite settled from the last one.
                  from: active.to - RARITY_GAIN[active.event.rarity],
                  rarity: active.event.rarity,
                  climber: camera + lead / pxPerMetre,
                  alpha: fx.lines,
                  lit: fx.lit,
                }
              : null,
          chip:
            active && fx && active.event.rarity
              ? {
                  text: active.event.answer,
                  rarity: active.event.rarity,
                  x: area.x,
                  // Rides above the runner's head, leaps included.
                  y: climberY - (fx.hop + 1.12) * area.size,
                  alpha: fx.chip,
                  lit: fx.lit,
                }
              : null,
        },
        climber: area && {
          x: area.x,
          y: climberY,
          size: area.size,
          alpha: presence,
          pose: fx ?? STANDING,
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

/** The climber's size, base line and room to pull ahead inside the UI's box. */
function climbingArea(box: DOMRect) {
  const size = Math.min(92, Math.max(44, box.height * 0.24));
  const base = box.bottom - size * 0.25;
  return { x: box.left + box.width / 2, base, size, room: Math.max(0, base - box.top - size * 1.6) };
}

function approach(value: number, target: number, step: number): number {
  return value + Math.sign(target - value) * Math.min(Math.abs(target - value), step);
}
