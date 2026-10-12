/**
 * Pure canvas drawing for the background (architecture "Rendering").
 * `progress` is 0 at the trailhead and 1 at the summit; `time` is in seconds.
 * The scene passes through forest, alpine, glacier, and death-zone bands as
 * progress rises (scope "Experience").
 */
import { drawClimber, type ClimberView } from './climber';
import { drawMarkers, type MarkersView } from './markers';

export interface SceneView {
  width: number;
  height: number;
  progress: number;
  time: number;
  /** Seconds of wind travel; runs faster while the camera rushes upward. */
  wind?: number;
  /** Camera effects from the climb animation (see climb.ts). */
  bob?: number;
  shake?: number;
  rush?: number;
  flash?: number;
  /** The runner, when one is on screen; the scene picks its colours. */
  climber?: Omit<ClimberView, 'time' | 'ink'> | null;
  /** What is pinned to the mountain: facts, landings, tier lines, the answer chip. */
  markers?: Omit<MarkersView, 'width' | 'height' | 'progress'> | null;
}

type Rgb = [number, number, number];
type Ramp = [number, Rgb][];

// Colour keyframes by progress: forest, alpine, glacier storm, death zone, summit sunrise.
const SKY_TOP: Ramp = [
  [0, [112, 142, 188]],
  [0.3, [138, 166, 204]],
  [0.6, [118, 128, 150]],
  [0.85, [44, 44, 98]],
  [1, [58, 62, 118]],
];
const SKY_HORIZON: Ramp = [
  [0, [250, 214, 176]],
  [0.3, [240, 222, 192]],
  [0.6, [204, 208, 216]],
  [0.85, [196, 164, 176]],
  [1, [250, 194, 150]],
];
// Tint for the nearer ridges: pine green, bare rock, blue ice.
const GROUND_TINT: Ramp = [
  [0, [34, 108, 78]],
  [0.22, [128, 108, 92]],
  [0.5, [140, 160, 192]],
  [1, [150, 168, 200]],
];

const WHITE: Rgb = [255, 248, 240];
const DARK: Rgb = [20, 24, 36];
const GOLD: Rgb = [255, 214, 160];

// Far to near. `base` is the ridge height as a fraction of the screen at the
// trailhead; `drop` is how far the layer sinks by the summit (parallax).
const LAYERS = [
  { seed: 11, base: 0.42, amplitude: 0.24, scale: 1.6, drop: 0.2, peak: 0.5, color: [150, 156, 186] as Rgb },
  { seed: 23, base: 0.5, amplitude: 0.17, scale: 2.4, drop: 0.42, peak: 0, color: [118, 126, 160] as Rgb },
  { seed: 37, base: 0.62, amplitude: 0.13, scale: 3.2, drop: 0.62, peak: 0, color: [92, 106, 138] as Rgb },
  { seed: 53, base: 0.74, amplitude: 0.1, scale: 4.4, drop: 0.84, peak: 0, color: [70, 86, 112] as Rgb },
  { seed: 71, base: 0.86, amplitude: 0.07, scale: 6.0, drop: 1.05, peak: 0, color: [48, 60, 82] as Rgb },
];

const CLOUD_COUNT = 6;
const CLOUD_SEA_COUNT = 14;
const SNOW_COUNT = 240;
const STAR_COUNT = 90;
const BIRD_COUNT = 4;
const STREAK_COUNT = 36;
const TREE_SLOTS = 140;
/** How much of the tree density a single tree takes to fade out. */
const TREE_FADE = 0.15;

export function drawScene(ctx: CanvasRenderingContext2D, view: SceneView): void {
  const { width, height } = view;
  const p = clamp01(view.progress);
  const horizon = ramp(SKY_HORIZON, p);
  const storm = smoothstep(0.45, 0.6, p) * (1 - smoothstep(0.76, 0.88, p));

  drawSky(ctx, view, p, horizon);
  drawStars(ctx, view, smoothstep(0.74, 0.9, p) * (1 - 0.5 * smoothstep(0.96, 1, p)));
  drawSun(ctx, view, p);
  drawDawn(ctx, view, 1 - smoothstep(0.12, 0.34, p));
  drawBirds(ctx, view, smoothstep(0.1, 0.2, p) * (1 - smoothstep(0.38, 0.48, p)));

  // Haze fades as the climber rises above it.
  const haze = (0.4 - 0.28 * p) * (1 + 0.08 * drift(3, view.time * 0.12));
  LAYERS.forEach((layer, i) => {
    drawRidge(ctx, view, layer, i, p, horizon, haze * (1 - i / LAYERS.length));
    // Clouds sit between the far and middle ranges, and sink below as you climb.
    if (i === 1) drawClouds(ctx, view, p, storm);
  });

  drawCloudSea(ctx, view, smoothstep(0.66, 0.86, p));
  drawMist(ctx, view, 1 - smoothstep(0, 0.3, p));
  drawDawn(ctx, view, 0.4 * (1 - smoothstep(0.12, 0.34, p)));
  drawMotes(ctx, view, 1 - smoothstep(0.1, 0.32, p));
  drawGustStreaks(ctx, view, 1 - smoothstep(0.1, 0.32, p));
  // The markers and runner are nearest the camera, so they move most with each step.
  const nearX = (view.shake ?? 0) * width * 1.4;
  const nearY = -(view.bob ?? 0) * height * 1.4;
  if (view.markers) {
    drawMarkers(ctx, {
      ...view.markers,
      x: view.markers.x + nearX,
      base: view.markers.base + nearY,
      width,
      height,
      progress: p,
    });
  }
  if (view.climber) {
    drawClimber(ctx, {
      ...view.climber,
      x: view.climber.x + nearX,
      y: view.climber.y + nearY,
      time: view.time,
      ink: mix(DARK, horizon, 0.12),
    });
  }
  drawStormShade(ctx, width, height, view.time, storm);
  drawSnow(ctx, view, storm);
  drawStreaks(ctx, view, view.rush ?? 0);
  drawFlash(ctx, view, view.flash ?? 0);
}

function drawSky(ctx: CanvasRenderingContext2D, { width, height }: SceneView, p: number, horizon: Rgb) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, rgb(ramp(SKY_TOP, p)));
  sky.addColorStop(0.75, rgb(horizon));
  sky.addColorStop(1, rgb(horizon));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
}

function drawStars(ctx: CanvasRenderingContext2D, { width, height, time }: SceneView, strength: number) {
  if (strength <= 0) return;
  for (let i = 0; i < STAR_COUNT; i++) {
    const twinkle = 0.6 + 0.4 * drift(i * 3.3, time * (0.4 + hash(i * 3.3) * 0.8));
    ctx.fillStyle = rgba(WHITE, strength * twinkle * (0.35 + hash(i * 8.1) * 0.6));
    const r = 0.5 + hash(i * 2.2) * 1.1;
    ctx.beginPath();
    ctx.arc(hash(i * 1.3) * width, hash(i * 6.1) ** 1.5 * height * 0.5, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSun(ctx: CanvasRenderingContext2D, { width, height, time }: SceneView, p: number) {
  const strength = smoothstep(0.82, 1, p);
  if (strength <= 0) return;
  const x = width * 0.72;
  // The sun rises over the horizon in the final stretch.
  const y = height * (0.5 - 0.1 * smoothstep(0.94, 1, p));
  const r = Math.max(width, height) * 0.45;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
  glow.addColorStop(0, rgba(GOLD, (0.6 + 0.06 * drift(5, time * 0.2)) * strength));
  glow.addColorStop(1, rgba(GOLD, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const disc = smoothstep(0.94, 1, p);
  if (disc <= 0) return;
  ctx.fillStyle = rgba([255, 236, 204], 0.9 * disc);
  ctx.beginPath();
  ctx.arc(x, y, Math.min(width, height) * 0.035, 0, Math.PI * 2);
  ctx.fill();
}

function drawBirds(ctx: CanvasRenderingContext2D, { width, height, time }: SceneView, strength: number) {
  if (strength <= 0) return;
  ctx.strokeStyle = rgba([60, 64, 80], 0.55 * strength);
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < BIRD_COUNT; i++) {
    // Each bird circles a slow, slightly tilted loop that wanders a little.
    const a = time * (0.12 + hash(i * 4.4) * 0.08) + i * 1.9;
    const loose = 1 + 0.25 * drift(i * 6.1, time * 0.07);
    const x = width * (0.24 + 0.06 * i) + Math.cos(a) * width * 0.09 * loose;
    const y = height * (0.22 + 0.03 * i) + Math.sin(a) * height * 0.035 * loose;
    const span = Math.min(width, height) * (0.012 + hash(i * 7.3) * 0.006);
    // Birds flap in bursts and glide in between, each on its own rhythm.
    const flapping = 0.15 + 0.85 * smoothstep(-0.2, 0.3, drift(i * 9.7, time * 0.3));
    const flap = Math.sin(time * (4.4 + hash(i * 1.4) * 1.4) + i * 2.1) * span * 0.45 * flapping;
    ctx.beginPath();
    ctx.moveTo(x - span, y - flap);
    ctx.quadraticCurveTo(x - span * 0.4, y - span * 0.15, x, y);
    ctx.quadraticCurveTo(x + span * 0.4, y - span * 0.15, x + span, y - flap);
    ctx.stroke();
  }
}

function drawRidge(
  ctx: CanvasRenderingContext2D,
  view: SceneView,
  layer: (typeof LAYERS)[number],
  index: number,
  p: number,
  horizon: Rgb,
  haze: number,
) {
  const { width, height } = view;
  // Near layers move more with the camera's footsteps and stumbles.
  const depth = index / (LAYERS.length - 1);
  const offsetX = (view.shake ?? 0) * width * (0.3 + depth);
  const baseY = height * (layer.base + layer.drop * p - (view.bob ?? 0) * (0.3 + depth));
  if (baseY - layer.amplitude * height > height) return;

  const noise = ridgeProfile(layer);
  const crest = (u: number) => {
    // The far range carries one dominant peak: the summit being climbed.
    const peak = layer.peak * Math.exp(-(((u - 0.64) / 0.16) ** 2));
    return baseY - (sampleProfile(noise, u) + peak) * layer.amplitude * height;
  };

  const pad = width * 0.05;
  const step = Math.max(4, width / 160);
  ctx.beginPath();
  ctx.moveTo(-pad, height);
  let top = height;
  for (let x = -pad; x <= width + pad + step; x += step) {
    const y = crest((x - offsetX) / width);
    top = Math.min(top, y);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width + pad, height);
  ctx.closePath();

  const tinted = mix(layer.color, ramp(GROUND_TINT, p), 0.45 * depth);
  const color = mix(tinted, horizon, haze);
  // The snowline creeps down the nearer ranges as you climb.
  const snow = layer.peak > 0 ? 0.45 : 0.12 + 0.5 * smoothstep(0.3, 0.7, p) * (1 - 0.4 * depth);
  const fill = ctx.createLinearGradient(0, top, 0, height);
  fill.addColorStop(0, rgb(mix(color, WHITE, snow)));
  fill.addColorStop(0.08 + 0.14 * snow, rgb(mix(color, WHITE, snow * 0.6)));
  fill.addColorStop(0.3, rgb(color));
  fill.addColorStop(1, rgb(mix(color, DARK, 0.3)));
  ctx.fillStyle = fill;
  ctx.fill();

  // The treeline thins out on the nearer ranges as you leave the foothills.
  if (index >= 2) drawTrees(ctx, view, crest, offsetX, mix(color, DARK, 0.35), 1 - smoothstep(0.06, 0.26, p), depth);
}

function drawTrees(
  ctx: CanvasRenderingContext2D,
  { width, height, time }: SceneView,
  crest: (u: number) => number,
  offsetX: number,
  color: Rgb,
  density: number,
  depth: number,
) {
  if (density <= 0) return;
  ctx.fillStyle = rgb(color);
  const prev = ctx.globalAlpha;
  for (let k = 0; k < TREE_SLOTS; k++) {
    // Each tree fades out over a short stretch of the climb instead of vanishing.
    const fade = clamp01((density * 0.75 - hash(k * 5.9 + depth * 17)) / TREE_FADE);
    if (fade <= 0) continue;
    ctx.globalAlpha = prev * fade;
    const u = (k + hash(k * 2.3)) / TREE_SLOTS;
    // Treetops lean in a breeze that rises and falls along the ridge, and
    // each tree is a little out of step. A gust sweeps left to right, so it
    // reaches each tree a moment apart.
    const breeze = 0.6 + 0.4 * drift(depth * 7 + 1, time * 0.15 - u * 0.8);
    const sway =
      Math.sin(time * (0.75 + hash(k * 1.1) * 0.35) + k * 1.7) * width * 0.0012 * breeze +
      gust(time - u * GUST_CROSSING) * width * 0.003;
    const x = u * width + offsetX;
    const h = height * (0.018 + 0.022 * depth) * (0.7 + hash(k * 3.7) * 0.6);
    const y = crest(u) + h * 0.15;
    const w = h * 0.36;
    // A pine: three stacked tiers.
    ctx.beginPath();
    for (let t = 0; t < 3; t++) {
      const ty = y - h * (t / 3);
      const tw = w * (1 - t * 0.25);
      const lean = sway * ((t + 1) / 3);
      ctx.moveTo(x - tw, ty);
      ctx.lineTo(x + lean, ty - h * 0.5);
      ctx.lineTo(x + tw, ty);
    }
    ctx.fill();
  }
  ctx.globalAlpha = prev;
}

function drawClouds(ctx: CanvasRenderingContext2D, view: SceneView, p: number, storm: number) {
  const { width, height } = view;
  const wind = view.wind ?? view.time;
  const bandY = height * (0.32 + 0.75 * p);
  const opacity = 0.42 - 0.22 * p + 0.25 * storm;
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const speed = 6 + hash(i * 3.1) * 10;
    const span = width * 1.6;
    const x = ((hash(i * 7.7) * span + wind * speed) % span) - width * 0.3;
    const y = bandY + (hash(i * 5.3) - 0.5) * height * 0.18;
    const rx = width * (0.09 + hash(i * 2.9) * 0.1);
    const ry = rx * 0.32;
    puff(ctx, x, y, rx, ry, opacity);
    puff(ctx, x + rx * 0.45, y - ry * 0.35, rx * 0.6, ry * 0.9, opacity * 0.8);
  }
}

/** Above the weather: a flat sea of cloud far below the climber. */
function drawCloudSea(ctx: CanvasRenderingContext2D, view: SceneView, strength: number) {
  if (strength <= 0) return;
  const { width, height } = view;
  const wind = view.wind ?? view.time;
  const top = height * (0.96 - 0.16 * strength) + drift(7, view.time * 0.1) * height * 0.004;

  const bank = ctx.createLinearGradient(0, top, 0, height);
  bank.addColorStop(0, rgba([248, 240, 236], 0));
  bank.addColorStop(0.35, rgba([248, 240, 236], 0.75 * strength));
  bank.addColorStop(1, rgba([236, 226, 230], 0.95 * strength));
  ctx.fillStyle = bank;
  ctx.fillRect(0, top, width, height - top);

  for (let i = 0; i < CLOUD_SEA_COUNT; i++) {
    const span = width * 1.4;
    const x = ((hash(i * 4.9) * span + wind * (3 + hash(i * 1.1) * 4)) % span) - width * 0.2;
    const y = top + height * (0.02 + hash(i * 6.6) * 0.06) + drift(i * 1.3, view.time * 0.13) * height * 0.003;
    const rx = width * (0.08 + hash(i * 3.4) * 0.08);
    puff(ctx, x, y, rx, rx * 0.28, 0.7 * strength);
  }
}

let puffSprite: HTMLCanvasElement | null = null;
const PUFF_SIZE = 128;

/** A soft white blob, drawn once and stamped for every cloud. */
function getPuffSprite(): HTMLCanvasElement | null {
  if (puffSprite) return puffSprite;
  if (typeof document === 'undefined') return null;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = PUFF_SIZE;
  const c = sprite.getContext('2d');
  if (!c) return null;
  const r = PUFF_SIZE / 2;
  const g = c.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(250,246,240,1)');
  g.addColorStop(1, 'rgba(250,246,240,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, PUFF_SIZE, PUFF_SIZE);
  puffSprite = sprite;
  return sprite;
}

function puff(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha: number) {
  const sprite = getPuffSprite();
  if (!sprite) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * clamp01(alpha);
  ctx.drawImage(sprite, x - rx, y - ry, rx * 2, ry * 2);
  ctx.globalAlpha = prev;
}

function drawMist(ctx: CanvasRenderingContext2D, view: SceneView, strength: number) {
  if (strength <= 0) return;
  const { width, height, time } = view;
  const wind = view.wind ?? time;
  // Slow wisps roll through the valley.
  for (let i = 0; i < 4; i++) {
    const span = width * 1.5;
    const x = ((hash(i * 6.3) * span + wind * (4 + hash(i * 2.1) * 4)) % span) - width * 0.25 + gust(time - 0.3) * width * 0.012;
    const y = height * (0.74 + hash(i * 3.9) * 0.18) + drift(i * 3.9, time * 0.08) * height * 0.006;
    const rx = width * (0.16 + hash(i * 8.7) * 0.1);
    puff(ctx, x, y, rx, rx * 0.16, 0.3 * strength);
  }
  const mist = ctx.createLinearGradient(0, height * 0.5, 0, height);
  mist.addColorStop(0, rgba([250, 226, 200], 0));
  mist.addColorStop(1, rgba([250, 226, 200], 0.5 * strength));
  ctx.fillStyle = mist;
  ctx.fillRect(0, 0, width, height);
}

function drawStormShade(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, storm: number) {
  if (storm <= 0) return;
  // The storm thickens and thins in uneven surges.
  ctx.fillStyle = rgba([170, 178, 194], (0.18 + 0.05 * drift(13, time * 0.18)) * storm);
  ctx.fillRect(0, 0, width, height);
}

function drawSnow(ctx: CanvasRenderingContext2D, view: SceneView, intensity: number) {
  if (intensity <= 0) return;
  const { width, height, time } = view;
  const wind = view.wind ?? time;
  const count = Math.round(SNOW_COUNT * intensity);
  // Wind picks up with the storm, slanting the snowfall.
  const slant = 12 + 70 * intensity;
  ctx.fillStyle = rgba([255, 255, 255], 0.75);
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const fall = 20 + hash(i * 1.7) * 40;
    const y = (hash(i * 9.1) * height + time * fall) % height;
    const x = (((hash(i * 4.3) * width + Math.sin(time * 0.6 + i) * 18 + wind * slant) % width) + width) % width;
    const r = 0.8 + hash(i * 6.7) * 1.6;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** Faint air streaks falling past the camera while it surges upward. */
function drawStreaks(ctx: CanvasRenderingContext2D, { width, height, time }: SceneView, rush: number) {
  if (rush <= 0.01) return;
  ctx.lineCap = 'round';
  for (let i = 0; i < STREAK_COUNT; i++) {
    const speed = height * (1.2 + hash(i * 2.7) * 1.4);
    const len = height * (0.05 + hash(i * 5.1) * 0.08) * rush;
    const y = (hash(i * 8.3) * height + time * speed) % (height + len) - len;
    const x = hash(i * 3.9) * width;
    ctx.strokeStyle = rgba(WHITE, 0.28 * rush * (0.4 + hash(i * 1.9) * 0.6));
    ctx.lineWidth = 1 + hash(i * 4.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + len);
    ctx.stroke();
  }
}

function drawFlash(ctx: CanvasRenderingContext2D, { width, height }: SceneView, flash: number) {
  if (flash <= 0.01) return;
  const x = width * 0.5;
  const y = height * 0.15;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, Math.max(width, height) * 0.8);
  glow.addColorStop(0, rgba(GOLD, 0.45 * flash));
  glow.addColorStop(1, rgba(GOLD, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}


/** Low golden light over the valley, strongest at the trailhead. */
function drawDawn(ctx: CanvasRenderingContext2D, { width, height, time }: SceneView, strength: number) {
  if (strength <= 0) return;
  const x = width * 0.28;
  const y = height * 0.5;
  const r = Math.max(width, height) * 0.62;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
  const pulse = 0.94 + 0.06 * drift(17, time * 0.16);
  glow.addColorStop(0, rgba([255, 226, 170], 0.85 * strength * pulse));
  glow.addColorStop(0.35, rgba([255, 200, 150], 0.35 * strength));
  glow.addColorStop(1, rgba([255, 200, 150], 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

const MOTE_COUNT = 40;

/** Seeds and pollen drifting in the breeze; each gust shoves them along. */
function drawMotes(ctx: CanvasRenderingContext2D, { width, height, time }: SceneView, strength: number) {
  if (strength <= 0) return;
  const slot = Math.floor(time / GUST_SLOT);
  const since = time - gustAt(slot).start;
  const push = (slot + smoothstep(0, GUST_CROSSING + 1, since)) * width * 0.35;
  ctx.fillStyle = rgba([255, 222, 150], 0.85 * strength);
  ctx.beginPath();
  for (let i = 0; i < MOTE_COUNT; i++) {
    const speed = 6 + hash(i * 1.9) * 14;
    const x = (((hash(i * 4.1) * width + time * speed + push * (0.5 + hash(i * 7.9))) % width) + width) % width;
    const y = height * (0.12 + hash(i * 6.3) * 0.7) + Math.sin(time * 0.7 + i * 2.3) * height * 0.012;
    const r = 1 + hash(i * 2.7) * 1.8;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** Seconds a gust takes to sweep across the screen from left to right. */
const GUST_CROSSING = 2;
const GUST_WISPS = 14;

/** Pale wisps of air that sweep across the sky with each gust. */
function drawGustStreaks(ctx: CanvasRenderingContext2D, { width, height, time }: SceneView, strength: number) {
  if (strength <= 0) return;
  // A late gust can still be crossing when the next slot begins.
  const slot = Math.floor(time / GUST_SLOT);
  const cycle = time - gustAt(slot).start >= 0 ? slot : slot - 1;
  const { start, strength: force } = gustAt(cycle);
  const since = time - start;
  if (since < 0 || since > GUST_CROSSING + 1) return;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, height * 0.003);
  // Weaker gusts carry fewer, fainter wisps.
  const wisps = Math.round(GUST_WISPS * (0.5 + 0.5 * force));
  for (let i = 0; i < wisps; i++) {
    // Each wisp trails a little behind the front, at its own height.
    const head = (since - hash(cycle * 7.1 + i * 3.7) * 0.6) / GUST_CROSSING;
    const length = width * (0.2 + hash(i * 5.3) * 0.2);
    const x = -length + (width + length * 2) * head;
    if (x < -length || x > width + length) continue;
    const fade = Math.sin(clamp01(head) * Math.PI);
    if (fade <= 0.02) continue;
    const y = height * (0.08 + hash(i * 2.9 + cycle) * 0.62);
    const rise = Math.sin(head * 5 + i) * height * 0.012;
    const curl = height * (0.008 + hash(i * 8.3) * 0.012);
    const line = ctx.createLinearGradient(x - length, 0, x, 0);
    line.addColorStop(0, rgba(WHITE, 0));
    line.addColorStop(0.75, rgba(WHITE, 0.75 * strength * force * fade));
    line.addColorStop(1, rgba(WHITE, 0));
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(x - length, y + rise);
    ctx.bezierCurveTo(x - length * 0.6, y + rise - curl, x - length * 0.3, y + rise + curl, x, y + rise - curl * 0.3);
    ctx.stroke();
  }
}

/** Gusts come one per slot of this many seconds, at an uneven point within it. */
const GUST_SLOT = 10;

interface Gust {
  start: number;
  length: number;
  /** 0..1 */
  strength: number;
  /** A weaker puff that sometimes trails the gust, or null. */
  echo: { start: number; length: number; strength: number } | null;
}

/** The gust in a slot: its timing, length, and strength vary from one to the next. */
function gustAt(slot: number): Gust {
  const start = slot * GUST_SLOT + 1.5 + hash(slot * 2.9) * 5;
  const length = 1.1 + hash(slot * 4.7) * 0.7;
  const strength = 0.6 + hash(slot * 8.3) * 0.4;
  const echo =
    hash(slot * 6.1) < 0.35
      ? { start: start + length + 0.4 + hash(slot * 3.3) * 1.2, length: 0.9, strength: strength * 0.45 }
      : null;
  return { start, length, strength, echo };
}

/** Wind strength from gusts at a moment, 0..1: roughly one every ten seconds. */
function gust(time: number): number {
  const slot = Math.floor(time / GUST_SLOT);
  let sum = 0;
  // A gust late in the previous slot, or its echo, can spill into this one.
  for (const g of [gustAt(slot - 1), gustAt(slot)]) {
    sum += puffOfWind(time, g);
    if (g.echo) sum += puffOfWind(time, g.echo);
  }
  return Math.min(1, sum);
}

function puffOfWind(time: number, g: { start: number; length: number; strength: number }): number {
  const t = time - g.start;
  if (t < 0 || t > g.length) return 0;
  return g.strength * Math.sin((t / g.length) * Math.PI) ** 2;
}

/** Smooth, aperiodic wobble in -1..1, so ambient motion never settles into a beat. */
function drift(seed: number, t: number): number {
  return (valueNoise(seed + 401, t) + 0.5 * valueNoise(seed + 809, t * 2.3)) / 0.75 - 1;
}

// Ridgelines never change, so their noise is sampled once per layer and
// interpolated each frame instead of being recomputed.
const PROFILE_MIN = -0.2;
const PROFILE_MAX = 1.2;
const PROFILE_STEPS = 1024;
const profiles = new Map<number, Float32Array>();

function ridgeProfile(layer: (typeof LAYERS)[number]): Float32Array {
  let profile = profiles.get(layer.seed);
  if (!profile) {
    profile = new Float32Array(PROFILE_STEPS + 1);
    for (let i = 0; i <= PROFILE_STEPS; i++) {
      const u = PROFILE_MIN + ((PROFILE_MAX - PROFILE_MIN) * i) / PROFILE_STEPS;
      profile[i] = ridge(layer.seed, u * layer.scale);
    }
    profiles.set(layer.seed, profile);
  }
  return profile;
}

function sampleProfile(profile: Float32Array, u: number): number {
  const f = ((u - PROFILE_MIN) / (PROFILE_MAX - PROFILE_MIN)) * PROFILE_STEPS;
  const i = Math.min(PROFILE_STEPS - 1, Math.max(0, Math.floor(f)));
  const t = Math.min(1, Math.max(0, f - i));
  return profile[i] + (profile[i + 1] - profile[i]) * t;
}

/** Fractal value noise in 0..1, used for ridgelines. */
function ridge(seed: number, x: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < 4; o++) {
    const n = valueNoise(seed + o * 101, x * freq);
    // Ridged noise on the first octave gives sharper crests.
    sum += amp * (o === 0 ? 1 - Math.abs(2 * n - 1) : n);
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / 0.9375;
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

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function smoothstep(a: number, b: number, v: number): number {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Smoothly interpolates between colour keyframes. */
function ramp(stops: Ramp, p: number): Rgb {
  for (let i = 1; i < stops.length; i++) {
    const [at, color] = stops[i];
    if (p <= at) {
      const [prevAt, prev] = stops[i - 1];
      return mix(prev, color, smoothstep(prevAt, at, p));
    }
  }
  return stops[stops.length - 1][1];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgb(c: Rgb): string {
  return `rgb(${c.map(Math.round).join(',')})`;
}

function rgba(c: Rgb, a: number): string {
  return `rgba(${c.map(Math.round).join(',')},${a})`;
}
