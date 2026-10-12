/**
 * Pure canvas drawing for the background (architecture "Rendering").
 * `progress` is 0 at the trailhead and 1 at the summit; `time` is in seconds.
 */
export interface SceneView {
  width: number;
  height: number;
  progress: number;
  time: number;
}

type Rgb = [number, number, number];

const SKY_LOW_TOP: Rgb = [164, 178, 196];
const SKY_LOW_HORIZON: Rgb = [232, 218, 198];
const SKY_HIGH_TOP: Rgb = [62, 74, 120];
const SKY_HIGH_HORIZON: Rgb = [240, 196, 168];

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
const SNOW_COUNT = 140;

export function drawScene(ctx: CanvasRenderingContext2D, view: SceneView): void {
  const { width, height } = view;
  const p = clamp01(view.progress);
  const horizon = mix(SKY_LOW_HORIZON, SKY_HIGH_HORIZON, p);

  drawSky(ctx, view, p, horizon);
  drawSunGlow(ctx, view, smoothstep(0.8, 1, p));

  // Haze fades as the climber rises above it.
  const haze = 0.4 - 0.28 * p;
  LAYERS.forEach((layer, i) => {
    drawRidge(ctx, view, layer, p, horizon, haze * (1 - i / LAYERS.length));
    // Clouds sit between the far and middle ranges, and sink below as you climb.
    if (i === 1) drawClouds(ctx, view, p);
  });

  drawMist(ctx, width, height, 1 - p);
  // Snow builds high on the mountain and clears for the summit.
  drawSnow(ctx, view, smoothstep(0.5, 0.75, p) * (1 - smoothstep(0.93, 1, p)));
}

function drawSky(ctx: CanvasRenderingContext2D, { width, height }: SceneView, p: number, horizon: Rgb) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, rgb(mix(SKY_LOW_TOP, SKY_HIGH_TOP, p)));
  sky.addColorStop(0.75, rgb(horizon));
  sky.addColorStop(1, rgb(horizon));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
}

function drawSunGlow(ctx: CanvasRenderingContext2D, { width, height }: SceneView, strength: number) {
  if (strength <= 0) return;
  const x = width * 0.72;
  const y = height * 0.42;
  const r = Math.max(width, height) * 0.45;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
  glow.addColorStop(0, rgba([255, 226, 190], 0.55 * strength));
  glow.addColorStop(1, rgba([255, 226, 190], 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function drawRidge(
  ctx: CanvasRenderingContext2D,
  { width, height }: SceneView,
  layer: (typeof LAYERS)[number],
  p: number,
  horizon: Rgb,
  haze: number,
) {
  const baseY = height * (layer.base + layer.drop * p);
  if (baseY - layer.amplitude * height > height) return;

  const step = Math.max(4, width / 160);
  ctx.beginPath();
  ctx.moveTo(0, height);
  let top = height;
  for (let x = 0; x <= width + step; x += step) {
    const u = x / width;
    // The far range carries one dominant peak: the summit being climbed.
    const peak = layer.peak * Math.exp(-(((u - 0.64) / 0.16) ** 2));
    const y = baseY - (ridge(layer.seed, u * layer.scale) + peak) * layer.amplitude * height;
    top = Math.min(top, y);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();

  const color = mix(layer.color, horizon, haze);
  const fill = ctx.createLinearGradient(0, top, 0, height);
  fill.addColorStop(0, rgb(mix(color, [255, 248, 240], layer.peak > 0 ? 0.45 : 0.12)));
  fill.addColorStop(0.3, rgb(color));
  fill.addColorStop(1, rgb(mix(color, [20, 24, 36], 0.3)));
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawClouds(ctx: CanvasRenderingContext2D, { width, height, time }: SceneView, p: number) {
  const bandY = height * (0.32 + 0.75 * p);
  const opacity = 0.42 - 0.22 * p;
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const speed = 6 + hash(i * 3.1) * 10;
    const span = width * 1.6;
    const x = ((hash(i * 7.7) * span + time * speed) % span) - width * 0.3;
    const y = bandY + (hash(i * 5.3) - 0.5) * height * 0.18;
    const rx = width * (0.09 + hash(i * 2.9) * 0.1);
    const ry = rx * 0.32;
    puff(ctx, x, y, rx, ry, opacity);
    puff(ctx, x + rx * 0.45, y - ry * 0.35, rx * 0.6, ry * 0.9, opacity * 0.8);
  }
}

function puff(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba([250, 246, 240], alpha));
  g.addColorStop(1, rgba([250, 246, 240], 0));
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

function drawMist(ctx: CanvasRenderingContext2D, width: number, height: number, strength: number) {
  if (strength <= 0) return;
  const mist = ctx.createLinearGradient(0, height * 0.55, 0, height);
  mist.addColorStop(0, rgba([236, 230, 222], 0));
  mist.addColorStop(1, rgba([236, 230, 222], 0.45 * strength));
  ctx.fillStyle = mist;
  ctx.fillRect(0, 0, width, height);
}

function drawSnow(ctx: CanvasRenderingContext2D, { width, height, time }: SceneView, intensity: number) {
  if (intensity <= 0) return;
  const count = Math.round(SNOW_COUNT * intensity);
  ctx.fillStyle = rgba([255, 255, 255], 0.75);
  for (let i = 0; i < count; i++) {
    const fall = 20 + hash(i * 1.7) * 40;
    const y = (hash(i * 9.1) * height + time * fall) % height;
    const x = (hash(i * 4.3) * width + Math.sin(time * 0.6 + i) * 18 + time * 12) % width;
    const r = 0.8 + hash(i * 6.7) * 1.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
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

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgb(c: Rgb): string {
  return `rgb(${c.map(Math.round).join(',')})`;
}

function rgba(c: Rgb, a: number): string {
  return `rgba(${c.map(Math.round).join(',')},${a})`;
}
