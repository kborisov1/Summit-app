/**
 * Pure canvas drawing for the runner (scope "Experience"), seen side-on and
 * facing whichever way it is heading, its body tilted into its motion. There
 * is no ground: it runs up through the scenery
 * on puffs of mist, leaps on rarer answers, and stands on a soft cushion of
 * mist between them. Between answers it stays alive: it breathes, fidgets now
 * and then (crouching down now and again), looks up while the player types, grows restless as time runs low,
 * and shakes its head at a miss.
 */
import type { ClimbFx } from './climb';

type Rgb = [number, number, number];

export type ClimberPose = Pick<ClimbFx, 'phase' | 'effort' | 'stride' | 'hop' | 'tuck' | 'crouch' | 'cheer' | 'slip'>;

export interface ClimberView {
  /** Where the feet rest, in CSS pixels. */
  x: number;
  y: number;
  /** Standing height of the figure, in CSS pixels. */
  size: number;
  /** Which way the runner faces: 1 right, -1 left, passing through 0 as it turns. */
  facing: number;
  /** Whole-body tilt about the hip, in radians; positive leans right. */
  tilt: number;
  /** 0..1 */
  alpha: number;
  time: number;
  pose: ClimberPose;
  mood: ClimberMood;
  ink: Rgb;
}

export interface ClimberMood {
  /** 0..1, looking up the mountain while the player types. */
  look: number;
  /** 0..1, restless as the prompt's time runs low. */
  tension: number;
  /** Seconds since the last wrong answer, for a head shake. */
  sinceMiss: number;
}

export const CALM: ClimberMood = { look: 0, tension: 0, sinceMiss: Infinity };

// Body proportions, in runner heights, measured up from the feet.
const THIGH = 0.25;
const SHIN = 0.25;
const TORSO = 0.29;
const NECK = 0.11;
const HEAD = 0.075;
const UPPER_ARM = 0.17;
const FOREARM = 0.16;

const WHITE: Rgb = [255, 248, 240];
const MIST: Rgb = [250, 246, 240];
const PACK: Rgb = [164, 92, 68];
const BEANIE: Rgb = [72, 98, 140];
const SKIN: Rgb = [206, 164, 134];

const HEAD_SHAKE_TIME = 0.7;
const FIDGET_TIME = 1.4;
const FIDGETS = ['stretch', 'shake', 'glance', 'bounce', 'crouch'] as const;

interface Fidget {
  kind: (typeof FIDGETS)[number];
  /** 0 for the near limb, 1 for the far one. */
  side: number;
  /** 0..1, how far into the gesture the runner is. */
  amount: number;
  /** 0..1 through the gesture. */
  t: number;
}

interface Point {
  x: number;
  y: number;
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
    side: hash(slot * 8.3) < 0.5 ? 0 : 1,
    amount: smoothstep(0, 0.3, t) * (1 - smoothstep(0.7, 1, t)),
    t,
  };
}

export function drawClimber(ctx: CanvasRenderingContext2D, view: ClimberView): void {
  if (view.alpha <= 0.01 || view.size <= 0) return;
  const { size, pose, time, ink, mood } = view;
  const { effort, stride, tuck, cheer, slip } = pose;
  const { look, tension } = mood;
  const standing = (1 - stride) * (1 - tuck) * (1 - pose.crouch) * (1 - slip) * (1 - cheer);
  const fidget = fidgetAt(time, tension);
  // Fidgets wait while the runner is busy or watching the mountain.
  const gesture = (kind: Fidget['kind'], side?: number) =>
    fidget && fidget.kind === kind && (side === undefined || fidget.side === side)
      ? fidget.amount * standing * (1 - look)
      : 0;

  // Breathing, quicker and deeper as time runs low.
  const pace = 1 + tension;
  const breath = standing * (Math.sin(time * 1.7 * pace) + 0.4 * Math.sin(time * 0.63 * pace + 1)) * 0.01 * (1 + tension);
  // Restless weight shifts and a bounce on the toes when time runs low.
  const restless = standing * tension * Math.abs(Math.sin(time * 4.2)) * 0.03;
  const bounce = gesture('bounce') * Math.abs(Math.sin((fidget?.t ?? 0) * Math.PI * 3)) * 0.08;
  // Crouching: winding up for a leap, soaking up a landing, or now and then just
  // dropping down on its heels for a moment.
  const crouch = Math.min(1, pose.crouch + 0.85 * gesture('crouch'));

  const lean = 0.08 + 0.25 * effort * stride + 0.25 * tuck + 0.3 * slip + 0.35 * crouch - 0.08 * cheer - 0.06 * look + breath;
  const legSwing = stride * (0.35 + 0.35 * effort);
  const armSwing = stride * (0.4 + 0.5 * effort);
  const cycle = (i: number) => 2 * Math.PI * (pose.phase + i * 0.5);

  // Legs from the hip, in runner heights with y up.
  const legs = [0, 1].map((i) => {
    const c = cycle(i);
    let thigh = legSwing * Math.sin(c) + 0.1 * lean;
    // Knees lift as each leg swings through.
    let bend = 0.08 + stride * (0.3 + 0.9 * effort) * Math.max(0, Math.cos(c)) + 0.6 * slip;
    // In a leap the near knee drives up and the far leg trails.
    thigh += tuck * (i === 0 ? 1 : -0.4);
    bend += tuck * (i === 0 ? 1.5 : 0.9);
    // A crouch folds both knees, thighs forward.
    thigh += crouch * (0.75 - i * 0.15);
    bend += crouch * 1.5;
    // Shaking out a leg kicks it forward loosely.
    const shake = gesture('shake', i);
    thigh += 0.45 * shake;
    bend += shake * (0.3 + 0.25 * Math.sin(time * 24));
    const knee = { x: Math.sin(thigh) * THIGH, y: -Math.cos(thigh) * THIGH };
    const foot = { x: knee.x + Math.sin(thigh - bend) * SHIN, y: knee.y - Math.cos(thigh - bend) * SHIN };
    return { knee, foot };
  });
  // Drop the body until the lower foot rests on the runner's line.
  const lowest = Math.min(...legs.map(({ foot }) => foot.y));
  const flight = 0.05 * effort * stride * Math.abs(Math.sin(cycle(0)));
  const hipY = -lowest + pose.hop + flight + restless + bounce - 0.05 * slip;
  // Body points are drawn facing right, then mirrored to the runner's facing
  // and tilted about the hip.
  const face = view.facing;
  const cos = Math.cos(view.tilt);
  const sin = Math.sin(view.tilt);
  const at = (p: Point): Point => {
    const lx = p.x * size * face;
    const ly = -p.y * size;
    return { x: view.x + lx * cos - ly * sin, y: view.y - hipY * size + lx * sin + ly * cos };
  };

  const shoulderRel = { x: Math.sin(lean) * TORSO, y: Math.cos(lean) * TORSO };
  const arm = (i: number) => {
    // Arms swing against the legs on the same side.
    let angle = -armSwing * Math.sin(cycle(i)) + 0.3 * lean;
    let elbow = 0.3 + 1.1 * effort * stride;
    const blendTo = (a: number, e: number, t: number) => {
      angle += (a - angle) * t;
      elbow += (e - elbow) * t;
    };
    // Arms swing back in a crouch, ready to throw forward into the leap.
    blendTo(-0.7 + i * 0.2, 0.25, crouch * (1 - tuck));
    blendTo(2.1 - i * 0.5, 0.3, tuck);
    blendTo(1.35 - i * 0.3, 0.4, slip);
    blendTo(Math.PI - 0.3 - i * 0.25, 0.1, cheer);
    blendTo(Math.PI - 0.15 - i * 0.1, 0.05, gesture('stretch'));
    // Typing has the runner shading its eyes to look up the mountain.
    blendTo(2.3, 1.9, i === 0 ? look * standing : 0);
    const e = { x: shoulderRel.x + Math.sin(angle) * UPPER_ARM, y: shoulderRel.y - Math.cos(angle) * UPPER_ARM };
    const hand = { x: e.x + Math.sin(angle + elbow) * FOREARM, y: e.y - Math.cos(angle + elbow) * FOREARM };
    return [at(shoulderRel), at(e), at(hand)];
  };
  const legPoints = (i: number) => [at({ x: 0, y: 0 }), at(legs[i].knee), at(legs[i].foot)];

  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * view.alpha;
  drawMist(ctx, view, pose);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const far = rgba(mix(ink, WHITE, 0.3), 1);
  const near = rgba(ink, 1);
  stroke(ctx, arm(1), far, size * 0.065);
  stroke(ctx, legPoints(1), far, size * 0.08);

  // Backpack, behind the torso.
  const hip = at({ x: 0, y: 0 });
  const shoulder = at(shoulderRel);
  const pack = at({ x: Math.sin(lean) * TORSO * 0.58 - Math.cos(lean) * 0.075, y: Math.cos(lean) * TORSO * 0.58 + Math.sin(lean) * 0.075 });
  ctx.save();
  ctx.translate(pack.x, pack.y);
  ctx.rotate(view.tilt);
  ctx.scale(face, 1);
  ctx.rotate(lean);
  ctx.fillStyle = rgba(mix(PACK, ink, 0.25), 1);
  ctx.beginPath();
  ctx.roundRect(-size * 0.065, -size * 0.11, size * 0.13, size * 0.22, size * 0.04);
  ctx.fill();
  ctx.restore();

  stroke(ctx, [hip, shoulder], near, size * 0.11);

  // The head faces up the mountain; it turns to glance back or shake at a miss.
  const miss = mood.sinceMiss / HEAD_SHAKE_TIME;
  const shakeHead = miss < 1 ? Math.sin(mood.sinceMiss * 24) * (1 - miss) : 0;
  const facing = Math.max(-1, Math.min(1, 1 - 1.8 * gesture('glance') - 1.2 * Math.abs(shakeHead)));
  const tilt = lean * 1.1 - 0.35 * look;
  const head = at({ x: shoulderRel.x + Math.sin(tilt) * NECK, y: shoulderRel.y + Math.cos(tilt) * NECK });
  drawHead(ctx, head, HEAD * size, facing * Math.sign(face || 1), look, near);

  stroke(ctx, legPoints(0), near, size * 0.085);
  stroke(ctx, arm(0), near, size * 0.065);
  ctx.globalAlpha = prev;
}

/**
 * The runner has no ground: it stands on a soft cushion of mist and kicks
 * up puffs that drift down behind it as it runs.
 */
function drawMist(ctx: CanvasRenderingContext2D, { x, y, size, facing }: ClimberView, pose: ClimberPose) {
  const prev = ctx.globalAlpha;
  const grounded = Math.max(0, 1 - pose.hop * 3);
  const cushion = ctx.createRadialGradient(x, y, 0, x, y, size * 0.4);
  cushion.addColorStop(0, rgba(MIST, 0.55 * grounded));
  cushion.addColorStop(1, rgba(MIST, 0));
  ctx.fillStyle = cushion;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.25);
  ctx.translate(-x, -y);
  ctx.beginPath();
  ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const kick = pose.stride * (1 - pose.tuck);
  if (kick < 0.05) return;
  for (let k = 0; k < 4; k++) {
    const t = (pose.phase * 2 + k / 4) % 1;
    ctx.globalAlpha = prev * 0.45 * kick * (1 - t);
    ctx.fillStyle = rgba(MIST, 1);
    ctx.beginPath();
    ctx.arc(x - facing * size * (0.08 + 0.3 * t), y + size * 0.5 * t, size * (0.04 + 0.07 * t), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = prev;
}

/** Head side-on in a beanie, the face on whichever side it is turned to. */
function drawHead(ctx: CanvasRenderingContext2D, centre: Point, r: number, facing: number, look: number, body: string) {
  ctx.save();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = rgba(SKIN, 1);
  ctx.beginPath();
  ctx.ellipse(
    centre.x + facing * r * 0.75,
    centre.y + r * (0.2 - 0.25 * look),
    r * (0.3 + 0.35 * Math.abs(facing)),
    r * 0.65,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = rgba(BEANIE, 1);
  ctx.fillRect(centre.x - r, centre.y - r, r * 2, r * (0.95 - 0.2 * look));
  ctx.restore();
  ctx.fillStyle = rgba(mix(BEANIE, WHITE, 0.4), 1);
  ctx.beginPath();
  ctx.arc(centre.x - facing * r * 0.2, centre.y - r * 1.02, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
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

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgba(c: Rgb, a: number): string {
  return `rgba(${c.map(Math.round).join(',')},${a})`;
}
