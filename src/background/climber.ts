/**
 * Pure canvas drawing for the climber (scope "Experience"). The climber is
 * seen from behind, scaling the rock face in front of it. Between answers it
 * stays alive: it breathes, fidgets now and then, looks up while the player
 * types, grows restless as time runs low, and shakes its head at a miss.
 */
import type { ClimbFx } from './climb';

type Rgb = [number, number, number];

export type ClimberPose = Pick<ClimbFx, 'phase' | 'effort' | 'reach' | 'lunge' | 'cheer' | 'slip'>;

export interface ClimberView {
  /** Where the feet rest, in CSS pixels. */
  x: number;
  y: number;
  /** Height of the figure from feet to fingertips, in CSS pixels. */
  size: number;
  /** 0..1 */
  alpha: number;
  time: number;
  pose: ClimberPose;
  mood: ClimberMood;
  ink: Rgb;
}

export interface ClimberMood {
  /** 0..1, looking up the wall while the player types. */
  look: number;
  /** 0..1, restless as the prompt's time runs low. */
  tension: number;
  /** Seconds since the last wrong answer, for a head shake. */
  sinceMiss: number;
}

export const CALM: ClimberMood = { look: 0, tension: 0, sinceMiss: Infinity };

// Body layout and limb lengths, in climber heights, measured up from the feet.
const HIP = 0.4;
const SHOULDER = 0.66;
const HEAD = 0.075;
const SHOULDER_WIDTH = 0.085;
const HIP_WIDTH = 0.055;
const UPPER_ARM = 0.17;
const FOREARM = 0.17;
const THIGH = 0.21;
const SHIN = 0.21;

const WHITE: Rgb = [255, 248, 240];
const PACK: Rgb = [164, 92, 68];
const BEANIE: Rgb = [72, 98, 140];
const SKIN: Rgb = [206, 164, 134];

const HEAD_SHAKE_TIME = 0.7;
const FIDGET_TIME = 1.4;
const FIDGETS = ['chalk', 'shake', 'foot', 'glance'] as const;

interface Fidget {
  kind: (typeof FIDGETS)[number];
  side: number;
  /** 0..1, how far into the gesture the climber is. */
  amount: number;
  /** 0..1 through the gesture. */
  t: number;
}

/** One small gesture every few seconds, at uneven times; more often when tense. */
function fidgetAt(time: number, tension: number): Fidget | null {
  const period = 5 - 2.2 * tension;
  const slot = Math.floor(time / period);
  const start = slot * period + hash(slot * 3.7) * period * 0.45;
  const t = (time - start) / FIDGET_TIME;
  if (t < 0 || t > 1) return null;
  return {
    kind: FIDGETS[Math.floor(hash(slot * 5.1) * FIDGETS.length)],
    side: hash(slot * 8.3) < 0.5 ? -1 : 1,
    amount: smoothstep(0, 0.3, t) * (1 - smoothstep(0.7, 1, t)),
    t,
  };
}

interface Point {
  x: number;
  y: number;
}

export function drawClimber(ctx: CanvasRenderingContext2D, view: ClimberView): void {
  if (view.alpha <= 0.01 || view.size <= 0) return;
  const { size, pose, time, ink, mood } = view;
  const { effort, reach, cheer, slip } = pose;
  const { look, tension } = mood;
  const holding = (1 - reach) * (1 - slip) * (1 - cheer);
  // Breathing while hanging on, quicker and deeper as time runs low.
  const pace = 1 + tension;
  const breath = holding * (Math.sin(time * 1.7 * pace) + 0.4 * Math.sin(time * 0.63 * pace + 1)) * 0.008 * (1 + 1.2 * tension);
  // Fidgets wait while the climber is busy or watching the wall.
  const fidget = fidgetAt(time, tension);
  const gesture = (kind: Fidget['kind'], side: number) =>
    fidget && fidget.kind === kind && fidget.side === side ? fidget.amount * holding * (1 - look) : 0;
  const cycle = (side: number) => 2 * Math.PI * pose.phase + (side < 0 ? 0 : Math.PI);

  // Each push from the legs lifts the body a little; a slip drops it.
  const push = reach * (0.025 + 0.03 * effort) * Math.abs(Math.sin(2 * Math.PI * pose.phase));
  const rise = push + 0.08 * pose.lunge - 0.08 * slip + breath;
  // The body shifts toward whichever hand is reaching, and shifts its weight
  // restlessly when time runs low.
  const sway =
    reach * 0.03 * Math.sin(2 * Math.PI * pose.phase) + holding * tension * 0.014 * Math.sin(time * 2.1 + Math.sin(time * 0.7));

  // Positions in climber heights: x right, y up from the feet.
  const hip = { x: sway, y: HIP + rise };
  const shoulder = { x: sway * 1.4, y: SHOULDER + rise };
  const at = (p: Point): Point => ({ x: view.x + p.x * size, y: view.y - p.y * size });

  const arm = (side: number) => {
    const root = { x: shoulder.x + side * SHOULDER_WIDTH, y: shoulder.y };
    // Opposite hand and foot reach together, the way climbers move.
    const up = Math.max(0, Math.sin(cycle(side)));
    let hand = {
      x: root.x + side * (0.1 + 0.03 * effort * up),
      y: root.y + 0.21 + reach * (0.14 + 0.1 * effort) * (up - 0.3),
    };
    // Typing has the climber eyeing the next hold, the free hand creeping up.
    hand.y += 0.03 * look * (side > 0 ? 1 : 0.4);
    // Chalking dips a hand into the bag at the hip; shaking out lets an arm hang loose.
    hand = blend(hand, { x: hip.x + side * 0.07, y: hip.y + 0.03 + 0.012 * Math.sin(time * 18) }, gesture('chalk', side));
    hand = blend(hand, { x: root.x + side * (0.17 + 0.025 * Math.sin(time * 26)), y: root.y - 0.22 }, gesture('shake', side));
    // A slip pulls the hands down off their holds; a cheer throws them up.
    hand = blend(hand, { x: root.x + side * 0.2, y: root.y - 0.05 }, slip);
    hand = blend(hand, { x: root.x + side * 0.16, y: root.y + 0.3 }, cheer);
    return limb(root, hand, UPPER_ARM, FOREARM, side);
  };
  const leg = (side: number) => {
    const root = { x: hip.x + side * HIP_WIDTH, y: hip.y };
    const up = Math.max(0, Math.sin(cycle(-side)));
    let foot = {
      x: root.x + side * (0.12 + 0.04 * up * reach),
      y: root.y - 0.36 + reach * (0.1 + 0.08 * effort) * up,
    };
    // Now and then a foot moves to a better hold.
    const shift = gesture('foot', side);
    foot = { x: foot.x + side * 0.05 * shift, y: foot.y + 0.08 * shift };
    // Legs dangle when the feet lose the rock or leave it in a lunge.
    const dangle = Math.max(slip, Math.min(1, pose.lunge * 2.5));
    foot = blend(foot, { x: root.x + side * 0.06, y: root.y - 0.4 }, dangle);
    // Knees splay out, frog-like, as on a steep face.
    return limb(root, foot, THIGH, SHIN, side);
  };

  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * view.alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  drawRope(ctx, view, at(hip));

  const body = rgba(ink, 1);
  for (const side of [-1, 1]) {
    stroke(ctx, leg(side).map(at), body, size * 0.075);
    stroke(ctx, arm(side).map(at), body, size * 0.06);
  }
  stroke(ctx, [at({ x: hip.x - HIP_WIDTH, y: hip.y }), at({ x: hip.x + HIP_WIDTH, y: hip.y })], body, size * 0.08);
  stroke(ctx, [at(hip), at(shoulder)], body, size * 0.12);
  stroke(
    ctx,
    [at({ x: shoulder.x - SHOULDER_WIDTH, y: shoulder.y }), at({ x: shoulder.x + SHOULDER_WIDTH, y: shoulder.y })],
    body,
    size * 0.07,
  );

  // The head turns to glance down or to shake at a miss, and tips back to look up.
  const glance = (fidget?.side ?? 0) * (gesture('glance', -1) + gesture('glance', 1));
  const miss = mood.sinceMiss / HEAD_SHAKE_TIME;
  const shakeHead = miss < 1 ? Math.sin(mood.sinceMiss * 24) * (1 - miss) * 0.9 : 0;
  const turn = Math.max(-1, Math.min(1, glance + shakeHead));
  const head = at({ x: shoulder.x + turn * 0.012, y: shoulder.y + 0.1 + 0.02 * look - 0.02 * Math.abs(glance) });
  drawHead(ctx, head, HEAD * size, turn, body);
  if (fidget?.kind === 'chalk' && holding * (1 - look) > 0.5) drawChalk(ctx, at({ x: hip.x + fidget.side * 0.07, y: hip.y + 0.08 }), size, fidget.t);

  const pack = at({ x: (hip.x + shoulder.x) / 2, y: hip.y + (shoulder.y - hip.y) * 0.55 });
  ctx.fillStyle = rgba(mix(PACK, ink, 0.2), 1);
  ctx.beginPath();
  ctx.roundRect(pack.x - size * 0.075, pack.y - size * 0.13, size * 0.15, size * 0.24, size * 0.04);
  ctx.fill();
  ctx.fillStyle = rgba(mix(PACK, WHITE, 0.25), 1);
  ctx.beginPath();
  ctx.roundRect(pack.x - size * 0.07, pack.y - size * 0.14, size * 0.14, size * 0.06, size * 0.03);
  ctx.fill();

  ctx.globalAlpha = prev;
}

/** Head from behind in a beanie; the cheek shows on whichever side it turns to. */
function drawHead(ctx: CanvasRenderingContext2D, centre: Point, r: number, turn: number, body: string) {
  ctx.save();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  if (Math.abs(turn) > 0.02) {
    ctx.fillStyle = rgba(SKIN, Math.min(1, Math.abs(turn) * 1.4));
    ctx.beginPath();
    ctx.ellipse(centre.x + Math.sign(turn) * r * (1.15 - 0.5 * Math.abs(turn)), centre.y + r * 0.25, r * 0.5, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = rgba(BEANIE, 1);
  ctx.fillRect(centre.x - r, centre.y - r, r * 2, r * 0.95);
  ctx.restore();
  ctx.fillStyle = rgba(mix(BEANIE, WHITE, 0.4), 1);
  ctx.beginPath();
  ctx.arc(centre.x, centre.y - r * 1.02, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** A few puffs of chalk dust rising off the hand once it leaves the bag. */
function drawChalk(ctx: CanvasRenderingContext2D, at: Point, size: number, t: number) {
  if (t < 0.55) return;
  const age = (t - 0.55) / 0.45;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = rgba(WHITE, 0.55 * (1 - age));
    ctx.beginPath();
    ctx.arc(at.x + (hash(i * 3.1) - 0.5) * size * 0.12, at.y - age * size * (0.08 + hash(i * 7.7) * 0.08), size * (0.012 + 0.02 * age), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A rope running from the harness down the face, swaying a little. */
function drawRope(ctx: CanvasRenderingContext2D, { size, time, pose }: ClimberView, harness: Point) {
  const length = size * 1.6;
  const sway = size * (0.05 * Math.sin(time * 0.9) + 0.03 * Math.sin(time * 2.3 + 1) + 0.06 * pose.reach * Math.sin(2 * Math.PI * pose.phase));
  const end = { x: harness.x + sway * 0.5, y: harness.y + length };
  const line = ctx.createLinearGradient(0, harness.y, 0, end.y);
  line.addColorStop(0, rgba(mix(PACK, WHITE, 0.35), 0.9));
  line.addColorStop(1, rgba(mix(PACK, WHITE, 0.35), 0));
  ctx.strokeStyle = line;
  ctx.lineWidth = Math.max(1, size * 0.022);
  ctx.beginPath();
  ctx.moveTo(harness.x, harness.y);
  ctx.bezierCurveTo(harness.x + sway, harness.y + length * 0.35, end.x - sway, harness.y + length * 0.7, end.x, end.y);
  ctx.stroke();
}

/**
 * A two-part limb from `root` toward `target`, bending its joint outward
 * on `bend`'s side (-1 left, 1 right). Returns root, joint and tip.
 */
function limb(root: Point, target: Point, a: number, b: number, bend: number): Point[] {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const d = Math.min(a + b - 1e-4, Math.max(1e-4, Math.hypot(dx, dy)));
  const angle = Math.atan2(dy, dx);
  const open = Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d))));
  // Turning the same way sends the joint to opposite sides for a limb
  // reaching up and one reaching down.
  const turn = Math.sign(dy || 1) * -bend;
  const joint = { x: root.x + a * Math.cos(angle + turn * open), y: root.y + a * Math.sin(angle + turn * open) };
  const tip = { x: root.x + d * Math.cos(angle), y: root.y + d * Math.sin(angle) };
  return [root, joint, tip];
}

function stroke(ctx: CanvasRenderingContext2D, points: Point[], color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

function smoothstep(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function blend(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgba(c: Rgb, a: number): string {
  return `rgba(${c.map(Math.round).join(',')},${a})`;
}

