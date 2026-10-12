/**
 * Pure canvas drawing for the background (architecture "Rendering").
 * `progress` is 0 at the trailhead and 1 at the summit; `time` is in seconds.
 * The scene passes through forest, alpine, glacier, and death-zone bands as
 * progress rises (scope "Experience").
 */
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
}

type Rgb = [number, number, number];
type Ramp = [number, Rgb][];

// Colour keyframes by progress: forest, alpine, glacier storm, death zone, summit sunrise.
const SKY_TOP: Ramp = [
  [0, [164, 178, 196]],
  [0.3, [138, 166, 204]],
  [0.6, [118, 128, 150]],
  [0.85, [44, 44, 98]],
  [1, [58, 62, 118]],
];
const SKY_HORIZON: Ramp = [
  [0, [232, 218, 198]],
  [0.3, [240, 222, 192]],
  [0.6, [204, 208, 216]],
  [0.85, [196, 164, 176]],
  [1, [250, 194, 150]],
];
// Tint for the nearer ridges: pine green, bare rock, blue ice.
const GROUND_TINT: Ramp = [
  [0, [62, 92, 74]],
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

export function drawScene(ctx: CanvasRenderingContext2D, view: SceneView): void {
  const { width, height } = view;
  const p = clamp01(view.progress);
  const horizon = ramp(SKY_HORIZON, p);
  const storm = smoothstep(0.45, 0.6, p) * (1 - smoothstep(0.76, 0.88, p));

  drawSky(ctx, view, p, horizon);
  drawStars(ctx, view, smoothstep(0.74, 0.9, p) * (1 - 0.5 * smoothstep(0.96, 1, p)));
  drawSun(ctx, view, p);
  drawBirds(ctx, view, smoothstep(0.1, 0.2, p) * (1 - smoothstep(0.38, 0.48, p)));

  // Haze fades as the climber rises above it.
  const haze = (0.4 - 0.28 * p) * (1 + 0.08 * Math.sin(view.time * 0.35));
  LAYERS.forEach((layer, i) => {
    drawRidge(ctx, view, layer, i, p, horizon, haze * (1 - i / LAYERS.length));
    // Clouds sit between the far and middle ranges, and sink below as you climb.
    if (i === 1) drawClouds(ctx, view, p, storm);
  });

  drawCloudSea(ctx, view, smoothstep(0.66, 0.86, p));
  drawMist(ctx, view, 1 - smoothstep(0, 0.3, p));
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
    const twinkle = 0.6 + 0.4 * Math.sin(time * (0.8 + hash(i * 3.3) * 1.6) + i);
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
  glow.addColorStop(0, rgba(GOLD, (0.6 + 0.06 * Math.sin(time * 0.6)) * strength));
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
    // Each bird circles a slow, slightly tilted loop.
    const a = time * (0.12 + hash(i * 4.4) * 0.08) + i * 1.9;
    const x = width * (0.24 + 0.06 * i) + Math.cos(a) * width * 0.09;
    const y = height * (0.22 + 0.03 * i) + Math.sin(a) * height * 0.035;
    const span = Math.min(width, height) * (0.012 + hash(i * 7.3) * 0.006);
    const flap = Math.sin(time * 5 + i * 2.1) * span * 0.45;
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
  for (let k = 0; k < TREE_SLOTS; k++) {
    if (hash(k * 5.9 + depth * 17) > density * 0.75) continue;
    const u = (k + hash(k * 2.3)) / TREE_SLOTS;
    // Treetops lean in a slow breeze; each tree is a little out of step.
    // A gust sweeps left to right, so it reaches each tree a moment apart.
    const sway = Math.sin(time * 0.9 + k * 1.7) * width * 0.0012 + gust(time - u * 0.9) * width * 0.003;
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
  const top = height * (0.96 - 0.16 * strength) + Math.sin(view.time * 0.3) * height * 0.004;

  const bank = ctx.createLinearGradient(0, top, 0, height);
  bank.addColorStop(0, rgba([248, 240, 236], 0));
  bank.addColorStop(0.35, rgba([248, 240, 236], 0.75 * strength));
  bank.addColorStop(1, rgba([236, 226, 230], 0.95 * strength));
  ctx.fillStyle = bank;
  ctx.fillRect(0, top, width, height - top);

  for (let i = 0; i < CLOUD_SEA_COUNT; i++) {
    const span = width * 1.4;
    const x = ((hash(i * 4.9) * span + wind * (3 + hash(i * 1.1) * 4)) % span) - width * 0.2;
    const y = top + height * (0.02 + hash(i * 6.6) * 0.06) + Math.sin(view.time * 0.4 + i * 1.3) * height * 0.003;
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
    const y = height * (0.74 + hash(i * 3.9) * 0.18) + Math.sin(time * 0.25 + i) * height * 0.006;
    const rx = width * (0.16 + hash(i * 8.7) * 0.1);
    puff(ctx, x, y, rx, rx * 0.16, 0.3 * strength);
  }
  const mist = ctx.createLinearGradient(0, height * 0.5, 0, height);
  mist.addColorStop(0, rgba([236, 230, 222], 0));
  mist.addColorStop(1, rgba([236, 230, 222], 0.55 * strength));
  ctx.fillStyle = mist;
  ctx.fillRect(0, 0, width, height);
}

function drawStormShade(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, storm: number) {
  if (storm <= 0) return;
  ctx.fillStyle = rgba([170, 178, 194], (0.18 + 0.04 * Math.sin(time * 0.5)) * storm);
  ctx.fillRect(0, 0, width, height);
}

function drawSnow(ctx: CanvasRenderingContext2D, view: SceneView, intensity: number) {
  if (intensity <= 0) return;
  const { width, height, time } = view;
  const wind = view.wind ?? time;
  const count = Math.round(SNOW_COUNT * intensity);
  // Wind picks up with the storm, slanting the snowfall.
  const drift = 12 + 70 * intensity;
  ctx.fillStyle = rgba([255, 255, 255], 0.75);
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const fall = 20 + hash(i * 1.7) * 40;
    const y = (hash(i * 9.1) * height + time * fall) % height;
    const x = (((hash(i * 4.3) * width + Math.sin(time * 0.6 + i) * 18 + wind * drift) % width) + width) % width;
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

/** A brief puff of wind, 0..1: about 1.4 s long, every 8-12 s. */
function gust(time: number): number {
  const cycle = Math.floor(time / 10);
  const t = time - cycle * 10 - 1 - hash(cycle * 2.9) * 6;
  if (t < 0 || t > 1.4) return 0;
  return Math.sin((t / 1.4) * Math.PI) ** 2;
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
