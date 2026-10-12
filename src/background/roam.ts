/**
 * How the runner moves across its lane (scope "Experience"): it takes short
 * strolls between answers, comes over to watch the answer bar while the player
 * types, drifts a little sideways during a climb, faces where it heads, and
 * tilts into its motion. Pure, and stepped once per frame by `Background`.
 */

export interface Roam {
  /** Offset from the lane's centre, in CSS pixels. */
  x: number;
  /** Horizontal speed, in CSS pixels per second. */
  v: number;
  /** 1 facing right, -1 left, passing through 0 as it turns. */
  facing: number;
  /** Whole-body tilt, in radians; positive leans right. */
  tilt: number;
  /** Leg cycle while strolling, and 0..1 how much it is strolling. */
  walkPhase: number;
  walking: number;
  /** Last frame's leap height, to tell rising from falling. */
  lastHop: number;
  /** Where the current stroll heads, and when and how often it last decided. */
  goal: number;
  nextAt: number;
  decisions: number;
}

export const ROAM_START: Roam = {
  x: 0,
  v: 0,
  facing: 1,
  tilt: 0,
  walkPhase: 0,
  walking: 0,
  lastHop: 0,
  goal: 0,
  nextAt: 0,
  decisions: 0,
};

export interface RoamInput {
  dt: number;
  time: number;
  /** Runner height, in CSS pixels. */
  size: number;
  /** How far either side of centre it may roam, in CSS pixels. */
  range: number;
  /** How far either side of centre the answer bar reaches, in CSS pixels. */
  bar: number;
  /** The climb in progress: its id, and where across the lane it began. */
  climb: { id: number; startX: number } | null;
  /** The player is typing, so the runner comes over to watch the answer bar. */
  typing: boolean;
  /** Current leap height, in runner heights. */
  hop: number;
}

// Speeds in runner heights per second: a stroll between answers, a run across during a climb.
const STROLL_SPEED = 1.1;
const CLIMB_SPEED = 2.4;
/** Seconds between the runner's decisions to stroll somewhere new, shortest and longest. */
const PAUSE_MIN = 2.5;
const PAUSE_MAX = 7;
/** How far one stroll goes, in runner heights, shortest and longest. */
const STROLL_MIN = 0.8;
const STROLL_MAX = 3;
/** How quickly the runner turns round, in facings per second. */
const TURN_RATE = 7;
/** Most the runner tilts into its motion, in radians. */
const MAX_TILT = 0.16;
/** Most a leap pitches the runner nose up or down, in radians. */
const MAX_PITCH = 0.22;

/** Where the runner is heading across its lane. */
export function roamGoal(roam: Roam, input: RoamInput): number {
  const { climb, range, size, bar } = input;
  if (climb) {
    // Each climb drifts a short way toward the roomier side, so the run stays mostly upward.
    const side = climb.startX >= 0 ? -1 : 1;
    return clamp(climb.startX + side * size * (1 + 1.5 * hash(climb.id * 7.3)), -range, range);
  }
  // While the player types it comes in over the answer bar, if it has wandered past its end.
  if (input.typing) return clamp(roam.x, -Math.min(bar, range), Math.min(bar, range));
  return roam.goal;
}

/** Every few seconds, at uneven times, the runner picks a short stroll or stays put. */
function decide(roam: Roam, input: RoamInput): Roam {
  if (input.climb || input.typing) return { ...roam, goal: roam.x, nextAt: input.time + PAUSE_MIN };
  if (input.time < roam.nextAt) return roam;
  const n = roam.decisions + 1;
  const nextAt = input.time + PAUSE_MIN + (PAUSE_MAX - PAUSE_MIN) * hash(n * 2.3);
  if (hash(n * 4.1) < 0.3) return { ...roam, goal: roam.x, nextAt, decisions: n };
  const { range, size } = input;
  // Mostly onward the way it faces, more often back toward the middle the further out it is.
  const outward = range > 0 ? roam.x / range : 0;
  const turn = hash(n * 6.7) < 0.3 + 0.5 * Math.abs(outward);
  const dir = turn ? -Math.sign(outward || roam.facing || 1) : Math.sign(roam.facing || 1);
  const step = size * (STROLL_MIN + (STROLL_MAX - STROLL_MIN) * hash(n * 9.7));
  return { ...roam, goal: clamp(roam.x + dir * step, -range, range), nextAt, decisions: n };
}

export function stepRoam(previous: Roam, input: RoamInput): Roam {
  const { dt, size, range, climb, hop } = input;
  const roam = decide(previous, input);
  const goal = roamGoal(roam, input);
  const top = (climb ? CLIMB_SPEED : STROLL_SPEED) * size;
  const wantV = clamp((goal - roam.x) * 2.5, -top, top);
  const v = roam.v + (wantV - roam.v) * Math.min(1, dt * 4);
  const x = clamp(roam.x + v * dt, -range, range);
  // It turns to face where it is going, and keeps its facing when it stops,
  // except that while the player types it turns toward the middle of the bar.
  const watch = input.typing && !climb && Math.abs(x) > size * 0.4 ? -Math.sign(x) : 0;
  const heading = Math.abs(v) > size * 0.15 ? Math.sign(v) : watch || Math.sign(roam.facing || 1);
  const facing = approach(roam.facing, heading, dt * TURN_RATE);
  // A stroll walks the legs at the pace of the ground covered; a climb runs its own.
  // A crawl too slow to see counts as standing, so the legs come to rest.
  const pace = Math.abs(v) < size * 0.05 ? 0 : Math.min(1, Math.abs(v) / (STROLL_SPEED * size));
  const walking = approach(roam.walking, climb ? 0 : pace, dt * 4);
  const walkPhase = roam.walkPhase + (Math.abs(v) * dt) / (size * 0.55);
  // Lean into the motion, nose up as a leap rises and down as it lands.
  const rising = dt > 0 ? (hop - roam.lastHop) / dt : 0;
  const pitch = -Math.sign(facing || 1) * clamp(rising * 0.12, -MAX_PITCH, MAX_PITCH);
  const wantTilt = clamp((v / (CLIMB_SPEED * size)) * MAX_TILT + pitch, -0.3, 0.3);
  const tilt = roam.tilt + (wantTilt - roam.tilt) * Math.min(1, dt * 6);
  return { ...roam, x, v, facing, tilt, walkPhase, walking, lastHop: hop };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function approach(value: number, target: number, step: number): number {
  return value + Math.sign(target - value) * Math.min(Math.abs(target - value), step);
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
