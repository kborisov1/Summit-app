/**
 * Small painting helpers shared by the background's drawing modules: seeded
 * noise for natural, aperiodic motion, colour mixing, and a soft cloud puff.
 */

export type Rgb = [number, number, number];
export type Ramp = [number, Rgb][];

/** Smooth, aperiodic wobble in -1..1, so ambient motion never settles into a beat. */
export function drift(seed: number, t: number): number {
  return (valueNoise(seed + 401, t) + 0.5 * valueNoise(seed + 809, t * 2.3)) / 0.75 - 1;
}

export function valueNoise(seed: number, x: number): number {
  const i = Math.floor(x);
  const t = x - i;
  const s = t * t * (3 - 2 * t);
  return hash(seed * 31.7 + i) * (1 - s) + hash(seed * 31.7 + i + 1) * s;
}

export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function smoothstep(a: number, b: number, v: number): number {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Smoothly interpolates between colour keyframes. */
export function ramp(stops: Ramp, p: number): Rgb {
  for (let i = 1; i < stops.length; i++) {
    const [at, color] = stops[i];
    if (p <= at) {
      const [prevAt, prev] = stops[i - 1];
      return mix(prev, color, smoothstep(prevAt, at, p));
    }
  }
  return stops[stops.length - 1][1];
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function rgb(c: Rgb): string {
  return `rgb(${c.map(Math.round).join(',')})`;
}

export function rgba(c: Rgb, a: number): string {
  return `rgba(${c.map(Math.round).join(',')},${a})`;
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

export function puff(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha: number) {
  const sprite = getPuffSprite();
  if (!sprite) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * clamp01(alpha);
  ctx.drawImage(sprite, x - rx, y - ry, rx * 2, ry * 2);
  ctx.globalAlpha = prev;
}
