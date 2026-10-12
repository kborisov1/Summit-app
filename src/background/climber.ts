/**
 * Pure canvas drawing for the climber (scope "Experience"). The climber is
 * seen from behind, scaling the mountain in front of it. It stays put on
 * screen while the scene scrolls past, so its reaches read as the climb.
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
  ink: Rgb;
}

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

interface Point {
  x: number;
  y: number;
}

export function drawClimber(ctx: CanvasRenderingContext2D, view: ClimberView): void {
  if (view.alpha <= 0.01 || view.size <= 0) return;
  const { size, pose, time, ink } = view;
  const { effort, reach, cheer, slip } = pose;
  const holding = 1 - reach;
  // Quiet breathing while hanging on.
  const breath = holding * (Math.sin(time * 1.7) + 0.4 * Math.sin(time * 0.63 + 1)) * 0.008;
  const cycle = (side: number) => 2 * Math.PI * pose.phase + (side < 0 ? 0 : Math.PI);

  // Each push from the legs lifts the body a little; a slip drops it.
  const push = reach * (0.025 + 0.03 * effort) * Math.abs(Math.sin(2 * Math.PI * pose.phase));
  const rise = push + pose.lunge - 0.08 * slip + breath;
  // The body shifts toward whichever hand is reaching.
  const sway = reach * 0.03 * Math.sin(2 * Math.PI * pose.phase);

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
    // Legs dangle when the feet lose the rock or leave it in a lunge.
    const dangle = Math.max(slip, Math.min(1, pose.lunge / 0.15));
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

  // The head, then the backpack over the back, which faces us.
  const head = at({ x: shoulder.x, y: shoulder.y + 0.1 });
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(head.x, head.y, HEAD * size, 0, Math.PI * 2);
  ctx.fill();

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

function blend(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgba(c: Rgb, a: number): string {
  return `rgba(${c.map(Math.round).join(',')},${a})`;
}

