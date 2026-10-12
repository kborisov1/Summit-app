/**
 * Pure canvas drawing for the climber and the ledge under its feet (scope
 * "Experience"). The climber stays put on screen while the ledge scrolls
 * beneath it, so the figure reads as climbing the slope.
 */
import type { ClimbFx } from './climb';

type Rgb = [number, number, number];

export type ClimberPose = Pick<ClimbFx, 'phase' | 'gait' | 'stride' | 'hop' | 'cheer' | 'stumble'>;

export interface ClimberView {
  /** Where the feet rest, in CSS pixels. */
  x: number;
  y: number;
  /** Standing height of the figure, in CSS pixels. */
  size: number;
  /** 0..1 */
  alpha: number;
  time: number;
  /** How far the ledge has scrolled, in climber heights. */
  ground: number;
  pose: ClimberPose;
  /** Rock colour for the ledge. */
  rock: Rgb;
  /** 0..1, how much snow lies on the ledge. */
  snow: number;
  ink: Rgb;
}

/** The slope the climber walks up, in radians. */
const SLOPE = 0.3;
const TAN_SLOPE = Math.tan(SLOPE);

// Body proportions, in climber heights.
const THIGH = 0.25;
const SHIN = 0.25;
const TORSO = 0.29;
const NECK = 0.11;
const HEAD = 0.075;
const UPPER_ARM = 0.17;
const FOREARM = 0.16;

const WHITE: Rgb = [255, 248, 240];
const DARK: Rgb = [20, 24, 36];
const PACK: Rgb = [164, 92, 68];

/** Ground covered by one stride, in climber heights. Running strides are longer. */
export function strideLength(gait: number): number {
  return 0.55 + 0.5 * gait;
}

export function drawClimber(ctx: CanvasRenderingContext2D, view: ClimberView): void {
  if (view.alpha <= 0.01 || view.size <= 0) return;
  const crest = (dx: number) => crestAt(view, dx);
  drawLedge(ctx, view, crest);
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * view.alpha;
  drawFigure(ctx, view, crest);
  ctx.globalAlpha = prev;
}

/** Height of the ledge surface `dx` pixels right of the feet, relative to them. */
function crestAt({ size, ground }: ClimberView, dx: number): number {
  const scale = size * 1.4;
  const bumps = (u: number) => valueNoise(5, u) + 0.4 * valueNoise(9, u * 2.7);
  const at = ground * size;
  // The surface always passes through the feet, so the climber never floats.
  return -dx * TAN_SLOPE - size * 0.08 * (bumps((dx + at) / scale) - bumps(at / scale));
}

let ledgeLayer: HTMLCanvasElement | null = null;

function drawLedge(ctx: CanvasRenderingContext2D, view: ClimberView, crest: (dx: number) => number) {
  if (typeof document === 'undefined') return;
  const { size, rock, snow } = view;
  const half = size * 4;
  const rise = half * TAN_SLOPE + size * 0.2;
  const depth = size * 0.75;
  const w = Math.ceil(half * 2);
  const h = Math.ceil(rise * 2 + depth);
  ledgeLayer ??= document.createElement('canvas');
  if (ledgeLayer.width < w || ledgeLayer.height < h) {
    ledgeLayer.width = Math.max(ledgeLayer.width, w);
    ledgeLayer.height = Math.max(ledgeLayer.height, h);
  }
  const c = ledgeLayer.getContext('2d');
  if (!c) return;
  c.clearRect(0, 0, ledgeLayer.width, ledgeLayer.height);
  // Layer origin sits at the feet.
  const ox = half;
  const oy = rise;
  const step = Math.max(3, size / 14);

  c.beginPath();
  c.moveTo(0, oy + crest(-half));
  for (let dx = -half; dx <= half; dx += step) c.lineTo(ox + dx, oy + crest(dx));
  for (let dx = half; dx >= -half; dx -= step) {
    // The rock is deepest under the climber and thins toward the ends.
    const taper = 1 - (dx / half) ** 2;
    c.lineTo(ox + dx, oy + crest(dx) + depth * (0.35 + 0.65 * taper));
  }
  c.closePath();
  const top = mix(rock, DARK, 0.25);
  const fill = c.createLinearGradient(0, oy - size * 0.2, 0, oy + depth);
  fill.addColorStop(0, rgba(mix(top, WHITE, snow * 0.7), 1));
  fill.addColorStop(0.25, rgba(top, 0.95));
  fill.addColorStop(1, rgba(mix(top, DARK, 0.3), 0));
  c.fillStyle = fill;
  c.fill();

  // A lighter lip along the surface: dry grass low down, snow higher up.
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = rgba(mix(mix(rock, WHITE, 0.35), WHITE, snow), 0.55 + 0.35 * snow);
  c.lineWidth = size * (0.03 + 0.04 * snow);
  c.beginPath();
  for (let dx = -half; dx <= half; dx += step) c.lineTo(ox + dx, oy + crest(dx) + c.lineWidth * 0.4);
  c.stroke();

  // Fade both ends into the scene.
  c.globalCompositeOperation = 'destination-in';
  const fade = c.createLinearGradient(0, 0, w, 0);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.3, 'rgba(0,0,0,1)');
  fade.addColorStop(0.7, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = fade;
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';

  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * view.alpha;
  ctx.drawImage(ledgeLayer, 0, 0, w, h, view.x - ox, view.y - oy, w, h);
  ctx.globalAlpha = prev;
}

interface Point {
  x: number;
  y: number;
}

function drawFigure(ctx: CanvasRenderingContext2D, view: ClimberView, crest: (dx: number) => number) {
  const { size, pose, time, ink } = view;
  const { gait, stride, cheer, stumble } = pose;
  const air = Math.min(1, pose.hop / 0.2);
  // Quiet breathing while standing.
  const breath = (1 - stride) * (Math.sin(time * 1.7) + 0.4 * Math.sin(time * 0.63 + 1)) * 0.012;

  const lean = 0.08 + SLOPE * 0.35 + 0.22 * gait * stride + 0.35 * stumble - 0.08 * cheer + breath;
  const legSwing = stride * (0.28 + 0.3 * gait);
  const armSwing = stride * (0.35 + 0.45 * gait);

  const cycle = (i: number) => 2 * Math.PI * (pose.phase + i * 0.5);
  const leg = (i: number) => {
    const c = cycle(i);
    let thigh = legSwing * Math.sin(c) + 0.1 * lean;
    // Knees lift as each leg swings forward, and the front leg bends to step up.
    let bend = 0.06 + stride * (0.25 + 0.9 * gait) * Math.max(0, Math.cos(c)) + 0.25 * stride * Math.max(0, Math.sin(c));
    bend += 0.7 * stumble;
    // Legs split in a leap: the near one reaches forward, the far one trails.
    thigh += air * (i === 0 ? 0.7 : -0.45);
    bend += air * (i === 0 ? 0.5 : 0.9);
    return { thigh, bend };
  };

  // Lay out the legs from the hip, then drop the body so the lower foot lands.
  const legs = [0, 1].map((i) => {
    const { thigh, bend } = leg(i);
    const knee = { x: Math.sin(thigh) * THIGH, y: Math.cos(thigh) * THIGH };
    const foot = { x: knee.x + Math.sin(thigh - bend) * SHIN, y: knee.y + Math.cos(thigh - bend) * SHIN };
    return { knee, foot };
  });
  const groundGap = Math.min(...legs.map(({ foot }) => crest(foot.x * size) / size - foot.y));
  // A running climber floats a little between footfalls.
  const flight = 0.05 * gait * stride * Math.abs(Math.sin(cycle(0)));
  const hipY = groundGap - pose.hop - flight - 0.04 * stumble;
  const at = (p: Point): Point => ({ x: view.x + p.x * size, y: view.y + (p.y + hipY) * size });

  const hip = at({ x: 0, y: 0 });
  const shoulderRel = { x: Math.sin(lean) * TORSO, y: -Math.cos(lean) * TORSO };
  const shoulder = at(shoulderRel);
  const head = at({ x: shoulderRel.x + Math.sin(lean * 1.15) * NECK, y: shoulderRel.y - Math.cos(lean * 1.15) * NECK });

  const arm = (i: number) => {
    // Arms swing against the legs on the same side.
    let angle = -armSwing * Math.sin(cycle(i)) + 0.4 * lean;
    let elbow = 0.2 + stride * 1.1 * gait;
    angle = angle * (1 - stumble) + (1.25 - i * 0.3) * stumble;
    angle = angle * (1 - cheer) + (Math.PI - 0.35 - i * 0.3) * cheer;
    elbow = elbow * (1 - cheer) + 0.12 * cheer;
    const e = { x: shoulderRel.x + Math.sin(angle) * UPPER_ARM, y: shoulderRel.y + Math.cos(angle) * UPPER_ARM };
    const hand = { x: e.x + Math.sin(angle + elbow) * FOREARM, y: e.y + Math.cos(angle + elbow) * FOREARM };
    return [shoulder, at(e), at(hand)];
  };
  const legPoints = (i: number) => [hip, at(legs[i].knee), at(legs[i].foot)];

  // Soft shadow on the slope, fading as the climber leaves the ground.
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * 0.22 * Math.max(0, 1 - pose.hop * 2.5);
  ctx.fillStyle = rgba(DARK, 1);
  ctx.beginPath();
  ctx.ellipse(view.x, view.y, size * 0.2, size * 0.035, -SLOPE, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = prev;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const far = rgba(mix(ink, view.rock, 0.35), 1);
  const near = rgba(ink, 1);
  limb(ctx, arm(1), far, size * 0.065);
  limb(ctx, legPoints(1), far, size * 0.08);

  // Backpack, behind the torso.
  const back = { x: -Math.cos(lean), y: -Math.sin(lean) };
  const packCentre = {
    x: hip.x + (shoulder.x - hip.x) * 0.58 + back.x * size * 0.075,
    y: hip.y + (shoulder.y - hip.y) * 0.58 + back.y * size * 0.075,
  };
  ctx.save();
  ctx.translate(packCentre.x, packCentre.y);
  ctx.rotate(lean);
  ctx.fillStyle = rgba(mix(PACK, ink, 0.25), 1);
  ctx.beginPath();
  ctx.roundRect(-size * 0.065, -size * 0.11, size * 0.13, size * 0.22, size * 0.04);
  ctx.fill();
  ctx.restore();

  limb(ctx, [hip, shoulder], near, size * 0.11);
  ctx.fillStyle = near;
  ctx.beginPath();
  ctx.arc(head.x, head.y, HEAD * size, 0, Math.PI * 2);
  ctx.fill();

  limb(ctx, legPoints(0), near, size * 0.085);
  limb(ctx, arm(0), near, size * 0.065);
}

function limb(ctx: CanvasRenderingContext2D, points: Point[], color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

function valueNoise(seed: number, x: number): number {
  const i = Math.floor(x);
  const t = x - i;
  const s = t * t * (3 - 2 * t);
  return hash(seed * 31.7 + i) * (1 - s) + hash(seed * 31.7 + i + 1) * s;
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgba(c: Rgb, a: number): string {
  return `rgba(${c.map(Math.round).join(',')},${a})`;
}
