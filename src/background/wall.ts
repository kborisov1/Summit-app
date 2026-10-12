/**
 * Pure canvas drawing for the rock face the climber scales (scope
 * "Experience"). The face is one continuous cliff for the whole run: its
 * features live in world space, so it scrolls past as the camera climbs.
 */

type Rgb = [number, number, number];

export interface WallView {
  /** Centre of the face and the climber's base line, in CSS pixels. */
  x: number;
  base: number;
  /** Screen size, in CSS pixels; the face runs its full height. */
  width: number;
  height: number;
  /** Climber height, in CSS pixels; the face's detail scales with it. */
  size: number;
  /** World height of the base line, in pixels: the camera's altitude. */
  offset: number;
  /** 0..1 */
  alpha: number;
  rock: Rgb;
  /** 0..1, how much snow lies on the holds. */
  snow: number;
}

const WHITE: Rgb = [255, 248, 240];
const DARK: Rgb = [20, 24, 36];
const STONE: Rgb = [134, 128, 122];

/** Half the face's width, in CSS pixels. */
export function wallHalfWidth(size: number, width: number): number {
  return Math.min(width * 0.34, Math.max(size * 1.7, 80));
}

let layer: HTMLCanvasElement | null = null;

export function drawWall(ctx: CanvasRenderingContext2D, view: WallView): void {
  if (view.alpha <= 0.01 || view.size <= 0 || typeof document === 'undefined') return;
  const half = wallHalfWidth(view.size, view.width);
  const w = Math.ceil(half * 2 + view.size);
  const h = Math.ceil(view.height);
  layer ??= document.createElement('canvas');
  if (layer.width < w || layer.height < h) {
    layer.width = Math.max(layer.width, w);
    layer.height = Math.max(layer.height, h);
  }
  const c = layer.getContext('2d');
  if (!c) return;
  c.clearRect(0, 0, layer.width, layer.height);
  // Layer origin: the face's centre at the top of the screen.
  const ox = w / 2;
  // Height up the face in world pixels, so features scroll with the climb.
  const worldAt = (y: number) => view.base - y + view.offset;

  drawFace(c, view, w, h, ox, half, worldAt);

  // Fade the face out behind the question at the top and the answer bar below.
  c.globalCompositeOperation = 'destination-in';
  const fade = c.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.16, 'rgba(0,0,0,1)');
  fade.addColorStop(0.84, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = fade;
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';

  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * view.alpha;
  ctx.drawImage(layer, 0, 0, w, h, view.x - ox, 0, w, h);
  ctx.globalAlpha = prev;
}

function drawFace(
  c: CanvasRenderingContext2D,
  { size, rock, snow }: WallView,
  w: number,
  h: number,
  ox: number,
  half: number,
  worldAt: (y: number) => number,
) {
  const step = Math.max(4, size / 10);
  const edge = (y: number, side: number) => {
    const u = worldAt(y) / (size * 1.1);
    const rough = 0.62 + 0.26 * valueNoise(side > 0 ? 3 : 7, u) + 0.12 * valueNoise(side > 0 ? 13 : 17, u * 3.3);
    // The face spreads toward its foot, like a buttress.
    return ox + side * half * rough * (0.85 + 0.25 * (y / h));
  };

  // An uneven slab of rock, its sides wandering as it scrolls.
  c.beginPath();
  c.moveTo(edge(0, -1), 0);
  for (let y = 0; y <= h; y += step) c.lineTo(edge(y, -1), y);
  for (let y = h; y >= 0; y -= step) c.lineTo(edge(y, 1), y);
  c.closePath();
  // Grey stone, tinted by the zone around it.
  const face = mix(mix(STONE, rock, 0.35), DARK, 0.1);
  const fill = c.createLinearGradient(ox - half, 0, ox + half, 0);
  fill.addColorStop(0, rgba(mix(face, DARK, 0.25), 1));
  fill.addColorStop(0.45, rgba(mix(face, WHITE, 0.08), 1));
  fill.addColorStop(1, rgba(mix(face, DARK, 0.35), 1));
  c.fillStyle = fill;
  c.fill();
  c.save();
  c.clip();

  // Rows of features in world space: soft banding, cracks and holds.
  const spacing = size * 0.34;
  const first = Math.floor(worldAt(h) / spacing) - 1;
  const last = Math.ceil(worldAt(0) / spacing) + 1;
  for (let k = first; k <= last; k++) {
    const y = worldAt(0) - k * spacing;
    if (hash(k * 1.9) < 0.3) {
      c.fillStyle = rgba(mix(face, hash(k * 4.1) < 0.5 ? DARK : WHITE, 0.12), 0.6);
      c.fillRect(0, y, w, spacing * (0.5 + hash(k * 2.2)));
    }
    if (hash(k * 6.3) < 0.28) {
      const x = ox + (hash(k * 2.7) - 0.5) * half * 1.4;
      c.strokeStyle = rgba(mix(face, DARK, 0.55), 0.7);
      c.lineWidth = Math.max(1, size * 0.018);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (hash(k * 9.1) - 0.5) * size * 0.4, y + spacing * 0.9);
      c.lineTo(x + (hash(k * 3.3) - 0.5) * size * 0.5, y + spacing * 2.2);
      c.stroke();
    }
    for (let j = 0; j < 2; j++) {
      const hx = ox + (hash(k * 3.1 + j * 17) - 0.5) * half * 1.3;
      const hy = y + hash(k * 5.7 + j * 11) * spacing;
      const r = size * (0.03 + 0.025 * hash(k * 7.9 + j));
      c.fillStyle = rgba(mix(face, DARK, 0.45), 0.9);
      c.beginPath();
      c.ellipse(hx, hy, r * 1.4, r, 0, 0, Math.PI * 2);
      c.fill();
      // A lit top edge, or a cap of snow up high.
      c.fillStyle = rgba(mix(mix(face, WHITE, 0.4), WHITE, snow), 0.85);
      c.beginPath();
      c.ellipse(hx, hy - r * 0.45, r * 1.2, r * (0.35 + 0.25 * snow), 0, Math.PI, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
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
