/**
 * Air and light around the climb (scope "Experience"): cloud banks pinned at
 * set heights that the camera rises up into and through, soft sun rays in the
 * lower zones, and a vignette that deepens with altitude toward the dark
 * death-zone sky and lifts again for the summit sunrise.
 */
import { clamp01, drift, hash, puff, rgba, smoothstep, type Rgb } from './paint';

export interface AtmosphereView {
  width: number;
  height: number;
  time: number;
  /** Seconds of wind travel, so banks drift faster in an updraft. */
  wind: number;
  /** The camera's altitude, in metres, and the screen line it sits on. */
  camera: number;
  base: number;
  pxPerMetre: number;
  /** 0 at the trailhead, 1 at the summit. */
  progress: number;
}

/** Cloud banks: their middle altitude and thickness, in metres. */
const BANKS = [
  { altitude: 1300, thickness: 280 },
  { altitude: 2900, thickness: 320 },
  { altitude: 4700, thickness: 300 },
];
const PUFFS_PER_BANK = 22;

const WHITE: Rgb = [250, 246, 240];
const GOLD: Rgb = [255, 222, 170];
const NIGHT: Rgb = [14, 16, 34];

/**
 * A cloud bank's puffs. The back pass is drawn behind the runner and the
 * front pass, thinner, in front of it, so the camera seems to climb through.
 */
export function drawCloudBanks(ctx: CanvasRenderingContext2D, view: AtmosphereView, pass: 'back' | 'front'): void {
  const { width, height, camera, base, pxPerMetre, wind } = view;
  BANKS.forEach((bank, b) => {
    const centre = base - (bank.altitude - camera) * pxPerMetre;
    const half = (bank.thickness / 2) * pxPerMetre;
    if (centre - half > height * 1.2 || centre + half < -height * 0.2) return;
    for (let i = 0; i < PUFFS_PER_BANK; i++) {
      const front = i % 3 === 0;
      if ((pass === 'front') !== front) continue;
      const seed = b * 97 + i;
      const span = width * 1.5;
      const x = ((hash(seed * 1.7) * span + wind * (5 + hash(seed * 2.9) * 6)) % span) - width * 0.25;
      const y = centre + (hash(seed * 3.3) - 0.5) * half * 1.6 + drift(seed, view.time * 0.1) * half * 0.08;
      const rx = width * (0.12 + hash(seed * 4.7) * 0.14);
      puff(ctx, x, y, rx, rx * 0.34, front ? 0.32 : 0.55);
    }
  });
  if (pass === 'front') drawVeil(ctx, view);
}

/** While the camera is inside a bank, a soft white veil washes over everything. */
function drawVeil(ctx: CanvasRenderingContext2D, { width, height, camera, base, pxPerMetre }: AtmosphereView) {
  let inside = 0;
  for (const bank of BANKS) {
    const centre = base - (bank.altitude - camera) * pxPerMetre;
    const reach = (bank.thickness / 2) * pxPerMetre + height * 0.25;
    inside = Math.max(inside, 1 - Math.abs(centre - height * 0.5) / reach);
  }
  if (inside <= 0) return;
  ctx.fillStyle = rgba(WHITE, 0.32 * inside * inside);
  ctx.fillRect(0, 0, width, height);
}

const RAY_COUNT = 7;

/**
 * Soft light shafts slanting down from the upper left in the foothills and
 * alpine, fading out in the storm; at the summit the rising sun throws faint
 * rays outward.
 */
export function drawSunRays(ctx: CanvasRenderingContext2D, view: AtmosphereView): void {
  const { width, height, time, progress: p } = view;
  const low = 1 - smoothstep(0.36, 0.5, p);
  const summit = smoothstep(0.94, 1, p);
  if (low <= 0.01 && summit <= 0.01) return;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'screen';
  if (low > 0.01) {
    rays(ctx, { x: width * 0.18, y: -height * 0.2 }, 0.95, 0.16, Math.max(width, height) * 1.5, low, time);
  }
  if (summit > 0.01) {
    // The summit sunrise sits where the scene draws its sun.
    rays(ctx, { x: width * 0.72, y: height * 0.4 }, -Math.PI, (Math.PI * 2) / RAY_COUNT, Math.max(width, height), summit * 0.6, time);
  }
  ctx.globalCompositeOperation = prev;
}

function rays(
  ctx: CanvasRenderingContext2D,
  origin: { x: number; y: number },
  start: number,
  step: number,
  length: number,
  strength: number,
  time: number,
) {
  for (let i = 0; i < RAY_COUNT; i++) {
    // Each shaft brightens and dims on its own slow, uneven rhythm.
    const shimmer = 0.55 + 0.45 * drift(i * 7.7, time * 0.06);
    const angle = start + i * step + drift(i * 3.1, time * 0.02) * 0.03;
    const spread = 0.025 + hash(i * 5.3) * 0.035;
    const end = (a: number) => ({ x: origin.x + Math.cos(a) * length, y: origin.y + Math.sin(a) * length });
    const a = end(angle - spread);
    const b = end(angle + spread);
    const glow = ctx.createLinearGradient(origin.x, origin.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    glow.addColorStop(0, rgba(GOLD, 0));
    glow.addColorStop(0.25, rgba(GOLD, 0.16 * strength * shimmer));
    glow.addColorStop(1, rgba(GOLD, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.closePath();
    ctx.fill();
  }
}

/** Darkens the edges more the higher the climb, easing off for the summit sunrise. */
export function drawVignette(ctx: CanvasRenderingContext2D, { width, height, progress: p }: AtmosphereView): void {
  const depth = clamp01(0.14 + 0.36 * smoothstep(0.5, 0.86, p) - 0.24 * smoothstep(0.93, 1, p));
  const cx = width * 0.5;
  const cy = height * 0.45;
  const shade = ctx.createRadialGradient(cx, cy, Math.min(width, height) * 0.35, cx, cy, Math.hypot(width, height) * 0.62);
  shade.addColorStop(0, rgba(NIGHT, 0));
  shade.addColorStop(1, rgba(NIGHT, depth));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
}
