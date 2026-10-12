/**
 * Pure canvas drawing for what is pinned to the mountain's world (scope
 * "Experience"): facts at their real heights, a pennant where each answer
 * landed, the tier lines of the climb in progress, and the answer chip that
 * rides above the runner. Everything is placed by altitude, so it scrolls
 * with the camera.
 */
import type { Landmark } from '../game/landmarks';
import { RARITY_GAIN, RARITY_LABEL } from '../game/scoring';
import type { Rarity } from '../game/types';

type Rgb = [number, number, number];

export interface Landing {
  altitude: number;
  rarity: Rarity;
  answer: string;
}

export interface MarkersView {
  width: number;
  height: number;
  /** Centre and half width of the runner's lane, in CSS pixels. */
  x: number;
  half: number;
  /** Screen line the camera's altitude sits on, in CSS pixels. */
  base: number;
  /** The camera's altitude, in metres. */
  camera: number;
  pxPerMetre: number;
  /** 0..1, for picking text colours that read against the sky. */
  progress: number;
  /** 0..1 */
  alpha: number;
  landmarks: readonly Landmark[];
  landings: readonly Landing[];
  /** Tier lines for the climb in progress, or null between climbs. */
  lines: {
    /** Altitude the climb started from. */
    from: number;
    /** The tier reached. */
    rarity: Rarity;
    /** Where the runner's feet are now, so lines flash as it passes them. */
    climber: number;
    /** 0..1 */
    alpha: number;
    /** 0..1, how brightly the reached line is lit on arrival. */
    lit: number;
  } | null;
  /** The answer riding above the runner, or null. */
  chip: { text: string; rarity: Rarity; x: number; y: number; alpha: number; lit: number } | null;
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
const INK: Rgb = [43, 50, 69];
const ACCENT: Rgb = [63, 74, 122];
const CHALK: Rgb = [250, 246, 238];
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** How far past a tier line, in metres, its flash takes to fade. */
const FLASH_METRES = 70;

export function drawMarkers(ctx: CanvasRenderingContext2D, view: MarkersView): void {
  if (view.alpha <= 0.01) return;
  const prev = ctx.globalAlpha;
  ctx.textBaseline = 'middle';
  drawLandmarks(ctx, view);
  drawLandings(ctx, view);
  drawTierLines(ctx, view);
  drawChip(ctx, view);
  ctx.globalAlpha = prev;
  ctx.shadowBlur = 0;
}

function screenY({ base, camera, pxPerMetre }: MarkersView, altitude: number): number {
  return base - (altitude - camera) * pxPerMetre;
}

/** Markers fade out behind the question at the top and the answer bar below. */
function edgeFade({ height }: MarkersView, y: number): number {
  return smoothstep(height * 0.1, height * 0.2, y) * (1 - smoothstep(height * 0.82, height * 0.9, y));
}

/** The facts only show while a climb is in progress, fading with its tier lines. */
function drawLandmarks(ctx: CanvasRenderingContext2D, view: MarkersView) {
  const { x, half, width, progress } = view;
  const climbing = view.lines?.alpha ?? 0;
  if (climbing <= 0.01) return;
  // Dark ink over the day sky, pale once the sky turns to night.
  const night = smoothstep(0.66, 0.8, progress);
  const ink = mix(INK, WHITE, night * 0.9);
  const halo = mix(WHITE, INK, night);
  view.landmarks.forEach((mark, i) => {
    const y = screenY(view, mark.altitude);
    const fade = edgeFade(view, y);
    if (fade <= 0.01) return;
    const left = i % 2 === 0;
    const size = mark.major ? 13 : 12;
    ctx.font = `${mark.major ? 700 : 500} ${size}px ${SANS}`;
    ctx.letterSpacing = mark.major ? '0.18em' : '0.02em';
    const text = left ? `${mark.text}  ──` : `──  ${mark.text}`;
    const tw = ctx.measureText(text).width;
    // Sit beside the runner's lane when there is room, else at the screen edge.
    const gap = 10;
    let tx: number;
    if (left) tx = x - half - gap - tw >= 12 ? x - half - gap - tw : 12;
    else tx = x + half + gap + tw <= width - 12 ? x + half + gap : width - 12 - tw;
    ctx.globalAlpha = view.alpha * climbing * fade * (mark.major ? 0.95 : 0.8);
    ctx.shadowColor = rgba(halo, 0.8);
    ctx.shadowBlur = 8;
    ctx.fillStyle = rgba(mark.major ? mix(ACCENT, WHITE, night * 0.75) : ink, 1);
    ctx.textAlign = 'left';
    ctx.fillText(text, tx, y);
  });
  ctx.letterSpacing = '0px';
  ctx.shadowBlur = 0;
}

/** A small pennant in the air where each answer landed, with its tier and answer. */
function drawLandings(ctx: CanvasRenderingContext2D, view: MarkersView) {
  const { x, half } = view;
  ctx.font = `600 11px ${SANS}`;
  for (const landing of view.landings) {
    const y = screenY(view, landing.altitude);
    const fade = edgeFade(view, y);
    if (fade <= 0.01) continue;
    const color = TIER_COLOR[landing.rarity];
    // Planted left of the runner's line, flying away from it, so the label
    // never crosses the runner standing at the newest landing.
    const pole = x - half * 0.4;
    ctx.globalAlpha = view.alpha * fade;
    ctx.strokeStyle = rgba(INK, 0.8);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pole, y);
    ctx.lineTo(pole, y - 20);
    ctx.stroke();
    ctx.fillStyle = rgba(color, 1);
    ctx.beginPath();
    ctx.moveTo(pole, y - 20);
    ctx.lineTo(pole - 13, y - 16);
    ctx.lineTo(pole, y - 12);
    ctx.closePath();
    ctx.fill();
    const label = `${RARITY_LABEL[landing.rarity]} · ${landing.answer}`;
    const pw = ctx.measureText(label).width + 12;
    const px = Math.max(8, pole - 17 - pw);
    ctx.fillStyle = rgba(WHITE, 0.82);
    ctx.beginPath();
    ctx.roundRect(px, y - 25, pw, 18, 9);
    ctx.fill();
    ctx.fillStyle = rgba(mix(color, INK, 0.45), 1);
    ctx.textAlign = 'left';
    ctx.fillText(label, px + 6, y - 15.5);
  }
}

/** Dashed chalk lines at each tier's gain; each flashes in its colour as the runner passes. */
function drawTierLines(ctx: CanvasRenderingContext2D, view: MarkersView) {
  const { lines, width } = view;
  if (!lines || lines.alpha <= 0.01) return;
  ctx.font = `600 12px ${SANS}`;
  ctx.letterSpacing = '0.08em';
  for (const r of RARITIES) {
    const altitude = lines.from + RARITY_GAIN[r];
    const y = screenY(view, altitude);
    const fade = edgeFade(view, y);
    if (fade <= 0.01) continue;
    const past = lines.climber - altitude;
    const passed = past >= 0 ? 1 : 0;
    const flash = past >= 0 ? Math.exp(-past / FLASH_METRES) : 0;
    const glow = Math.max(flash, r === lines.rarity ? lines.lit : 0);
    const color = TIER_COLOR[r];
    ctx.globalAlpha = view.alpha * lines.alpha * fade;

    ctx.setLineDash(passed ? [] : [9, 7]);
    ctx.strokeStyle = rgba(passed ? mix(color, WHITE, 0.25 * glow) : mix(CHALK, INK, 0.25), passed ? 0.95 : 0.6);
    ctx.lineWidth = 2 + 1.5 * glow;
    ctx.shadowColor = rgba(color, 0.9);
    ctx.shadowBlur = passed ? 6 + 18 * glow : 0;
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(width - 12, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // The tag sits above the right end of the line, like a chalked note.
    const label = `${RARITY_LABEL[r].toUpperCase()} · +${RARITY_GAIN[r].toLocaleString('en-US')} m`;
    ctx.textAlign = 'right';
    ctx.shadowColor = rgba(passed ? color : WHITE, 0.9);
    ctx.shadowBlur = passed ? 10 * (0.5 + glow) : 6;
    ctx.fillStyle = rgba(passed ? mix(color, INK, 0.15) : mix(INK, WHITE, 0.15), 1);
    ctx.fillText(label, width - 16, y - 11);
  }
  ctx.letterSpacing = '0px';
  ctx.shadowBlur = 0;
}

/** The answer in a pill above the runner, turning the tier's colour on arrival. */
function drawChip(ctx: CanvasRenderingContext2D, view: MarkersView) {
  const { chip } = view;
  if (!chip || chip.alpha <= 0.01) return;
  ctx.font = `700 15px ${SANS}`;
  ctx.letterSpacing = '0.04em';
  const text = `“${chip.text}”  ▲`;
  const tw = ctx.measureText(text).width;
  const w = tw + 26;
  const h = 32;
  const left = Math.min(view.width - 8 - w, Math.max(8, chip.x - w / 2));
  const color = mix(ACCENT, TIER_COLOR[chip.rarity], chip.lit);
  ctx.globalAlpha = view.alpha * chip.alpha;
  ctx.shadowColor = rgba(color, 0.7);
  ctx.shadowBlur = 18;
  ctx.fillStyle = rgba(WHITE, 0.92);
  ctx.beginPath();
  ctx.roundRect(left, chip.y - h, w, h, h / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(color, 0.9);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = rgba(color, 1);
  ctx.textAlign = 'left';
  ctx.fillText(text, left + 13, chip.y - h / 2 + 1);
  ctx.letterSpacing = '0px';
}

function smoothstep(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgba(c: Rgb, a: number): string {
  return `rgba(${c.map(Math.round).join(',')},${a})`;
}
