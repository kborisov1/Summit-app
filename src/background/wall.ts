/**
 * Pure canvas drawing for the rock face the climber scales and the tier lines
 * chalked across it (scope "Experience"). The face scrolls down as the
 * climber gains height, so the line it reaches becomes the new base.
 */
import { RARITY_GAIN, RARITY_LABEL } from '../game/scoring';
import type { Rarity } from '../game/types';
import { tierLine } from './climb';

type Rgb = [number, number, number];

export interface WallView {
  /** Centre of the face and the climber's base line, in CSS pixels. */
  x: number;
  /** Screen width, so labels stay on screen. */
  width: number;
  base: number;
  /** Climber height, in CSS pixels; the face's detail scales with it. */
  size: number;
  /** Height above the base the legendary line sits at, in CSS pixels. */
  room: number;
  /** How far the face has scrolled over the whole run, in rooms. */
  scrolled: number;
  /** 0..1 */
  alpha: number;
  rock: Rgb;
  /** 0..1, how much snow lies on the holds. */
  snow: number;
  /** Tier lines for the climb in progress, or null between climbs. */
  lines: {
    /** The tier reached. */
    rarity: Rarity;
    /** 0..1 */
    alpha: number;
    /** 0..1, how brightly the reached line is lit. */
    lit: number;
    /** How far this climb has scrolled the face so far, in rooms. */
    scroll: number;
  } | null;
}

// Tier colours, matching `--tier-1` to `--tier-5` in styles.css.
const TIER_COLOR: Record<Rarity, Rgb> = {
  1: [125, 135, 148],
  2: [106, 140, 118],
  3: [76, 125, 152],
  4: [122, 104, 166],
  5: [176, 127, 51],
};
const RARITIES: Rarity[] = [1, 2, 3, 4, 5];

const WHITE: Rgb = [255, 248, 240];
const DARK: Rgb = [20, 24, 36];
const CHALK: Rgb = [250, 246, 238];
const STONE: Rgb = [134, 128, 122];

let layer: HTMLCanvasElement | null = null;

export function drawWall(ctx: CanvasRenderingContext2D, view: WallView): void {
  if (view.alpha <= 0.01 || view.size <= 0 || typeof document === 'undefined') return;
  const { size, room } = view;
  const half = Math.max(size * 1.8, 80);
  const above = room + size * 1.6;
  const below = size * 1.4;
  const w = Math.ceil(half * 2 + size);
  const h = Math.ceil(above + below);
  layer ??= document.createElement('canvas');
  if (layer.width < w || layer.height < h) {
    layer.width = Math.max(layer.width, w);
    layer.height = Math.max(layer.height, h);
  }
  const c = layer.getContext('2d');
  if (!c) return;
  c.clearRect(0, 0, layer.width, layer.height);
  // Layer origin: the face's centre on the base line.
  const ox = w / 2;
  const oy = above;
  // Height up the face in world pixels, so features scroll with the climb.
  const offset = view.scrolled * room;
  const worldAt = (y: number) => oy - y + offset;

  drawFace(c, view, w, h, ox, oy, half, worldAt);

  // Fade the top and bottom of the face into the scene.
  c.globalCompositeOperation = 'destination-in';
  const fade = c.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.18, 'rgba(0,0,0,1)');
  fade.addColorStop(0.8, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = fade;
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';

  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * view.alpha;
  ctx.drawImage(layer, 0, 0, w, h, view.x - ox, view.base - oy, w, h);
  ctx.globalAlpha = prev;

  if (view.lines && view.lines.alpha > 0.01) drawLines(ctx, view, half);
}

function drawFace(
  c: CanvasRenderingContext2D,
  { size, rock, snow }: WallView,
  w: number,
  h: number,
  ox: number,
  oy: number,
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
    const y = oy - (k * spacing - worldAt(oy));
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

/** Chalk lines for every tier, with the reached one lit and labelled. */
function drawLines(ctx: CanvasRenderingContext2D, view: WallView, half: number) {
  const { lines, size, room, x } = view;
  if (!lines) return;
  const prev = ctx.globalAlpha;
  const fontSize = Math.max(11, Math.min(13, size * 0.15));
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  ctx.textBaseline = 'middle';
  // All labels go on one side: right of the face, else left, else on the
  // face itself on a narrow screen. The widest lit label decides.
  const pad = size * 0.12;
  const widest = Math.max(...RARITIES.map((r) => ctx.measureText(litLabel(r)).width)) + 16;
  const side =
    x + half + pad + widest <= view.width - 8 ? 'right' : x - half - pad - widest >= 8 ? 'left' : 'inside';
  for (const r of RARITIES) {
    const y = view.base - (tierLine(r) - lines.scroll) * room;
    const reached = r === lines.rarity;
    const glow = reached ? lines.lit : 0;
    const color = TIER_COLOR[r];
    ctx.globalAlpha = prev * view.alpha * lines.alpha * (reached ? 1 : 0.75);

    ctx.lineCap = 'round';
    ctx.setLineDash(glow > 0.5 ? [] : [size * 0.1, size * 0.08]);
    ctx.strokeStyle = rgba(mix(CHALK, color, 0.35 + 0.5 * glow), 0.85);
    ctx.lineWidth = Math.max(1.5, size * (0.025 + 0.025 * glow));
    if (glow > 0) {
      ctx.shadowColor = rgba(color, 0.9);
      ctx.shadowBlur = size * 0.25 * glow;
    }
    ctx.beginPath();
    ctx.moveTo(x - half * 0.95, y);
    ctx.lineTo(x + half * 0.95, y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);

    const label = glow > 0.05 ? litLabel(r) : RARITY_LABEL[r];
    const pw = ctx.measureText(label).width + 16;
    const px = side === 'right' ? x + half + pad : side === 'left' ? x - half - pad - pw : x - half * 0.9;
    const ph = fontSize + 8;
    ctx.fillStyle = rgba(mix(WHITE, color, glow * 0.85), (side === 'inside' ? 0.85 : 0.55) + 0.15 * glow);
    ctx.beginPath();
    ctx.roundRect(px, y - ph / 2, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = rgba(glow > 0.5 ? WHITE : mix(color, DARK, 0.35), 1);
    ctx.fillText(label, px + 8, y + 0.5);
  }
  ctx.globalAlpha = prev;
}

function litLabel(r: Rarity): string {
  return `${RARITY_LABEL[r]}  +${RARITY_GAIN[r].toLocaleString('en-US')} m`;
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
