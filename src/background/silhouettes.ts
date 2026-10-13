/**
 * Rocky ledges jutting in from the screen's edges, pinned to the mountain at
 * real heights, which scroll past as the camera climbs (scope "Experience").
 * Each ledge carries what grows or stands there: pines and boulders in the
 * foothills, crags and spires in the alpine, ice seracs on the glaciers, and
 * bare wind-carved rock up high. Two layers give depth:
 * a hazy middle layer that drifts by slowly and a dark near layer that rushes
 * past faster than the mountain itself.
 */
import { hash, mix, rgba, valueNoise, type Rgb } from './paint';

export interface SilhouetteView {
  width: number;
  height: number;
  /** The camera's altitude, in metres, and the screen line it sits on. */
  camera: number;
  base: number;
  pxPerMetre: number;
  /** Ground colour at an altitude, from the scene's zone palette. */
  tintAt: (altitude: number) => Rgb;
  horizon: Rgb;
  layer: 'mid' | 'near';
}

type Kind = 'pine' | 'boulder' | 'crag' | 'serac' | 'windrock';

interface Layer {
  /** Metres between slots, and how many slots stay empty. */
  spacing: number;
  gaps: number;
  /** How fast it scrolls relative to the mountain. */
  parallax: number;
  /** How far in from each screen edge shapes may stand, as a share of the width. */
  reach: number;
  /** Shape heights, as shares of the screen height. */
  minHeight: number;
  maxHeight: number;
  /** How dark, and how lost in haze, the layer is. */
  shade: number;
  haze: number;
}

const LAYERS: Record<SilhouetteView['layer'], Layer> = {
  mid: { spacing: 260, gaps: 0.45, parallax: 0.7, reach: 0.2, minHeight: 0.09, maxHeight: 0.16, shade: 0.25, haze: 0.42 },
  near: { spacing: 380, gaps: 0.45, parallax: 1.35, reach: 0.12, minHeight: 0.18, maxHeight: 0.3, shade: 0.45, haze: 0.1 },
};

const WHITE: Rgb = [255, 248, 240];
const DARK: Rgb = [20, 24, 36];
const ICE: Rgb = [214, 228, 240];
const STONE: Rgb = [128, 122, 116];
const GRASS: Rgb = [96, 132, 92];

/** Zone boundaries in metres, softened so neighbouring kinds mingle at the seams. */
export function kindAt(altitude: number, roll: number, pick: number): Kind {
  const seam = (edge: number) => altitude + (roll - 0.5) * 600 < edge;
  if (seam(1900)) return pick < 0.65 ? 'pine' : 'boulder';
  if (seam(4100)) return pick < 0.55 ? 'crag' : 'boulder';
  if (seam(7200)) return pick < 0.7 ? 'serac' : 'crag';
  return 'windrock';
}

export function drawSilhouettes(ctx: CanvasRenderingContext2D, view: SilhouetteView): void {
  const layer = LAYERS[view.layer];
  const { width, height, camera, base, pxPerMetre } = view;
  const scale = pxPerMetre * layer.parallax;
  const seed = view.layer === 'near' ? 17 : 5;
  const tallest = layer.maxHeight * height;
  // Slots whose shapes could reach the screen, from the bottom edge to the top.
  const first = Math.floor((camera - (height - base) / scale) / layer.spacing) - 1;
  const last = Math.ceil((camera + (base + tallest) / scale) / layer.spacing) + 1;
  for (let k = Math.max(-2, first); k <= last; k++) {
    if (hash(k * 3.3 + seed) < layer.gaps) continue;
    const altitude = (k + hash(k * 7.1 + seed) * 0.6) * layer.spacing;
    const y = base - (altitude - camera) * scale;
    const h = height * (layer.minHeight + (layer.maxHeight - layer.minHeight) * hash(k * 5.9 + seed));
    if (y - h > height || y < -0.05 * height) continue;
    const left = hash(k * 2.3 + seed) < 0.5;
    const side = left ? 1 : -1;
    const edge = left ? 0 : width;
    // The ledge reaches in from the edge; what stands on it sits near its tip.
    const reach = width * layer.reach * (0.55 + 0.45 * hash(k * 8.7 + seed));
    const x = edge + side * reach * 0.62;
    const kind = kindAt(altitude, hash(k * 4.4 + seed), hash(k * 6.6 + seed));
    const tint = view.tintAt(altitude);
    const shade = (c: Rgb) => mix(mix(c, DARK, layer.shade), view.horizon, layer.haze);
    const rock = shade(mix(STONE, tint, 0.3));
    drawLedge(ctx, edge, side, reach, y, h, rock, lipColour(altitude, tint), k * 11.3 + seed);
    const body = kind === 'pine' ? shade(tint) : rock;
    drawShape(ctx, kind, x, y, h, body, k * 13.7 + seed, side);
  }
}

/** The ledge's top edge: grass low down, bare rock, then snow. */
function lipColour(altitude: number, tint: Rgb): Rgb {
  if (altitude < 1900) return mix(GRASS, tint, 0.4);
  if (altitude < 4100) return mix(STONE, WHITE, 0.25);
  return WHITE;
}

/**
 * A rocky outcrop growing out of the screen's edge: a flat-ish top at `y`
 * reaching `reach` in, and a craggy underside tapering back to the edge.
 */
function drawLedge(
  ctx: CanvasRenderingContext2D,
  edge: number,
  side: number,
  reach: number,
  y: number,
  h: number,
  rock: Rgb,
  lip: Rgb,
  seed: number,
) {
  const depth = h * (0.45 + 0.3 * hash(seed));
  const out = edge - side * 20;
  const tip = edge + side * reach;
  const top = (t: number) => y - h * 0.04 * valueNoise(seed, t * 4) + h * 0.03 * t;
  ctx.beginPath();
  ctx.moveTo(out, top(0) - h * 0.02);
  for (let t = 0; t <= 1.0001; t += 0.1) ctx.lineTo(edge + side * reach * t, top(t));
  // The underside steps back toward the edge in a few rough facets.
  for (let t = 1; t >= 0; t -= 0.2) {
    const u = 1 - t;
    ctx.lineTo(
      edge + side * reach * t * (0.9 - 0.15 * valueNoise(seed + 5, t * 3)),
      y + depth * u ** 0.7 * (0.85 + 0.3 * valueNoise(seed + 9, t * 5)),
    );
  }
  ctx.lineTo(out, y + depth * 1.1);
  ctx.closePath();
  const fill = ctx.createLinearGradient(tip, 0, edge, 0);
  fill.addColorStop(0, rgba(mix(rock, WHITE, 0.12), 1));
  fill.addColorStop(1, rgba(mix(rock, DARK, 0.25), 1));
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = rgba(lip, 0.85);
  ctx.lineWidth = Math.max(1.5, h * 0.025);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let t = 0; t <= 1.0001; t += 0.1) {
    const px = edge + side * reach * t;
    if (t === 0) ctx.moveTo(out, top(0));
    ctx.lineTo(px, top(t));
  }
  ctx.stroke();
}

/**
 * One shape standing on (x, y), `h` tall. `lean` is 1 on the left edge and
 * -1 on the right, so shapes lean in toward the middle of the screen.
 */
function drawShape(ctx: CanvasRenderingContext2D, kind: Kind, x: number, y: number, h: number, colour: Rgb, seed: number, lean: number) {
  // Lit from above, a little darker where it meets the ledge.
  const fill = ctx.createLinearGradient(0, y - h, 0, y);
  fill.addColorStop(0, rgba(mix(colour, WHITE, 0.06), 1));
  fill.addColorStop(1, rgba(mix(colour, DARK, 0.12), 1));
  const lit = rgba(mix(colour, WHITE, 0.22), 0.9);
  switch (kind) {
    case 'pine':
      return drawPines(ctx, x, y, h, fill, lit, seed);
    case 'boulder':
      return drawBoulder(ctx, x, y, h, fill, lit, seed);
    case 'crag':
      return drawCrag(ctx, x, y, h, fill, lit, seed, lean);
    case 'serac':
      return drawSerac(ctx, x, y, h, colour, seed);
    case 'windrock':
      return drawWindrock(ctx, x, y, h, fill, seed, lean);
  }
}

/** Two or three pines of different heights, lit along their left edges. */
function drawPines(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, fill: CanvasGradient, lit: string, seed: number) {
  const count = 2 + Math.floor(hash(seed) * 2);
  for (let i = 0; i < count; i++) {
    const th = h * (0.55 + 0.45 * hash(seed + i * 3.1));
    const tx = x + (i - (count - 1) / 2) * h * 0.22 + (hash(seed + i * 5.3) - 0.5) * h * 0.1;
    const tw = th * 0.32;
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let t = 0; t < 4; t++) {
      const ty = y - th * (t / 4) * 0.85;
      const w = tw * (1 - t * 0.2);
      ctx.moveTo(tx - w, ty);
      ctx.lineTo(tx, ty - th * 0.38);
      ctx.lineTo(tx + w, ty);
    }
    ctx.fill();
    ctx.strokeStyle = lit;
    ctx.lineWidth = Math.max(1, h * 0.012);
    ctx.beginPath();
    ctx.moveTo(tx - tw * 0.6, y - th * 0.55);
    ctx.lineTo(tx, y - th * 1.0);
    ctx.stroke();
  }
}

/** A rounded, lumpy boulder with a lit crown. */
function drawBoulder(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, fill: CanvasGradient, lit: string, seed: number) {
  const bh = h * 0.32;
  const bw = bh * (1.3 + 0.4 * hash(seed));
  const point = (a: number) => {
    const r = 0.85 + 0.25 * valueNoise(seed, a * 1.6);
    return { x: x + Math.cos(a) * bw * 0.5 * r, y: y - bh * 0.5 - Math.sin(a) * bh * 0.5 * r };
  };
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i <= 18; i++) {
    const p = point((i / 18) * Math.PI * 2);
    if (i === 0) ctx.moveTo(p.x, Math.min(p.y, y));
    else ctx.lineTo(p.x, Math.min(p.y, y));
  }
  ctx.fill();
  ctx.strokeStyle = lit;
  ctx.lineWidth = Math.max(1, h * 0.015);
  ctx.beginPath();
  for (let i = 5; i <= 12; i++) {
    const p = point((i / 18) * Math.PI * 2);
    if (i === 5) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

/** A tall, jagged spire of rock leaning in from the edge, its sunlit face picked out. */
function drawCrag(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, fill: CanvasGradient, lit: string, seed: number, lean: number) {
  const w = h * (0.32 + 0.12 * hash(seed));
  const tip = { x: x + lean * w * 0.35, y: y - h };
  const side = (t: number, s: number) => ({
    x: x + s * w * 0.5 * (1 - t) ** 0.8 + (tip.x - x) * t + (valueNoise(seed + s * 9, t * 6) - 0.5) * w * 0.25,
    y: y - h * t,
  });
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y);
  for (let t = 0; t <= 1; t += 0.1) {
    const p = side(t, -1);
    ctx.lineTo(p.x, p.y);
  }
  for (let t = 1; t >= 0; t -= 0.1) {
    const p = side(t, 1);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = lit;
  ctx.lineWidth = Math.max(1, h * 0.01);
  ctx.beginPath();
  for (let t = 0.15; t <= 1; t += 0.1) {
    const p = side(t, -1);
    if (t === 0.15) ctx.moveTo(p.x + w * 0.06, p.y);
    else ctx.lineTo(p.x + w * 0.06, p.y);
  }
  ctx.stroke();
}

/** A cluster of tilted ice blocks, pale on top with blue crevasses. */
function drawSerac(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, colour: Rgb, seed: number) {
  const ice = mix(colour, ICE, 0.55);
  const count = 2 + Math.floor(hash(seed) * 2);
  for (let i = 0; i < count; i++) {
    const bh = h * (0.45 + 0.45 * hash(seed + i * 2.1));
    const bw = h * (0.16 + 0.1 * hash(seed + i * 4.3));
    const bx = x + (i - (count - 1) / 2) * h * 0.2;
    const slant = (hash(seed + i * 6.7) - 0.5) * bh * 0.3;
    const fill = ctx.createLinearGradient(0, y - bh, 0, y);
    fill.addColorStop(0, rgba(mix(ice, WHITE, 0.35), 1));
    fill.addColorStop(1, rgba(ice, 1));
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(bx - bw / 2, y);
    ctx.lineTo(bx - bw / 2, y - bh + slant);
    ctx.lineTo(bx + bw / 2, y - bh - slant);
    ctx.lineTo(bx + bw / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(mix(ice, [70, 110, 160], 0.6), 0.55);
    ctx.lineWidth = Math.max(1, h * 0.01);
    ctx.beginPath();
    const cx = bx + (hash(seed + i * 8.9) - 0.5) * bw * 0.5;
    ctx.moveTo(cx, y - bh * 0.85);
    ctx.lineTo(cx + bw * 0.08, y - bh * 0.3);
    ctx.stroke();
  }
}

/** An angular slab of dark rock scoured by wind, a drift of snow along its top. */
function drawWindrock(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, fill: CanvasGradient, seed: number, lean: number) {
  const w = h * (0.5 + 0.2 * hash(seed));
  const rh = h * (0.5 + 0.3 * hash(seed + 1));
  const top = [
    { x: x - w * 0.5, y: y - rh * 0.55 },
    { x: x - w * 0.1 + lean * w * 0.15, y: y - rh },
    { x: x + w * 0.35, y: y - rh * 0.78 },
    { x: x + w * 0.5, y: y - rh * 0.35 },
  ];
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y);
  for (const p of top) ctx.lineTo(p.x, p.y);
  ctx.lineTo(x + w * 0.5, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(WHITE, 0.8);
  ctx.lineWidth = Math.max(1.5, h * 0.025);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  for (const p of top.slice(1, 3)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}
