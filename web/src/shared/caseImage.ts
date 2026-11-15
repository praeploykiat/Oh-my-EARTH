import { trendIntercept } from "../core/analysis/series";
import type { SeriesPoint } from "../core/data";

export interface CaseImage {
  eyebrow: string;
  title: string;
  subtitle: string;
  badge: string;
  series: SeriesPoint[];
  slopePerStep: number;
  source: string;
  footer: string;
  fileName: string;
}

const WIDTH = 1200;
const HEIGHT = 675;
const SCALE = 2;
const PAD = 64;
const COLORS = {
  top: "#0c0e0e",
  bottom: "#16201e",
  fg: "#ffffff",
  muted: "#929e9a",
  accent: "#b7e08a",
  gold: "#ff9a3d",
  data: "#b7e08a",
  grid: "rgba(255, 255, 255, 0.1)",
};
const DISPLAY = 'Prompt, "IBM Plex Sans Thai", Inter, sans-serif';
const SANS = 'Inter, "IBM Plex Sans Thai", sans-serif';

// Text

function words(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    return [...segmenter.segment(text)].map((part) => part.segment);
  }
  return text.split(/(\s+)/);
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of words(text)) {
    const next = line + word;
    if (ctx.measureText(next).width > maxWidth && line.trim()) {
      lines.push(line.trim());
      line = word.trimStart();
    } else {
      line = next;
    }
  }
  if (line.trim()) lines.push(line.trim());
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
  return kept;
}

// Drawing

function drawBackground(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, COLORS.top);
  sky.addColorStop(1, COLORS.bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawBadge(ctx: CanvasRenderingContext2D, text: string) {
  ctx.font = `600 18px ${SANS}`;
  const width = ctx.measureText(text).width + 32;
  const x = WIDTH - PAD - width;
  ctx.fillStyle = "rgba(255, 154, 61, 0.16)";
  ctx.beginPath();
  ctx.roundRect(x, 52, width, 40, 20);
  ctx.fill();
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(text, x + 16, 79);
}

function drawChart(
  ctx: CanvasRenderingContext2D,
  series: SeriesPoint[],
  slope: number,
  top: number,
  bottom: number,
) {
  const values = series.flatMap((p) => (p.value === null ? [] : [p.value]));
  if (values.length < 2) return;

  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const left = PAD;
  const right = WIDTH - PAD;
  const x = (i: number) =>
    left + (i / Math.max(series.length - 1, 1)) * (right - left);
  const y = (v: number) => bottom - ((v - min) / span) * (bottom - top);

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (const ratio of [0, 0.5, 1]) {
    const lineY = top + (bottom - top) * ratio;
    ctx.beginPath();
    ctx.moveTo(left, lineY);
    ctx.lineTo(right, lineY);
    ctx.stroke();
  }

  const points = series.flatMap((p, i) =>
    p.value === null ? [] : [[x(i), y(p.value)] as const],
  );

  const area = ctx.createLinearGradient(0, top, 0, bottom);
  area.addColorStop(0, "rgba(79, 209, 165, 0.35)");
  area.addColorStop(1, "rgba(79, 209, 165, 0)");
  ctx.fillStyle = area;
  ctx.beginPath();
  ctx.moveTo(points[0][0], bottom);
  for (const [px, py] of points) ctx.lineTo(px, py);
  ctx.lineTo(points[points.length - 1][0], bottom);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = COLORS.data;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach(([px, py], i) =>
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py),
  );
  ctx.stroke();

  const intercept = trendIntercept(series, slope);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x(0), y(intercept));
  ctx.lineTo(x(series.length - 1), y(intercept + slope * (series.length - 1)));
  ctx.stroke();

  ctx.fillStyle = COLORS.muted;
  ctx.font = `14px ${SANS}`;
  ctx.fillText(series[0].t.slice(0, 4), left, bottom + 24);
  const last = series[series.length - 1].t.slice(0, 4);
  ctx.fillText(last, right - ctx.measureText(last).width, bottom + 24);
}

// Export

export async function renderCaseImage(image: CaseImage): Promise<Blob> {
  await document.fonts?.ready;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = HEIGHT * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");
  ctx.scale(SCALE, SCALE);

  drawBackground(ctx);
  drawBadge(ctx, image.badge);

  ctx.fillStyle = COLORS.accent;
  ctx.font = `600 18px ${SANS}`;
  ctx.fillText(image.eyebrow, PAD, 78);

  ctx.fillStyle = COLORS.fg;
  ctx.font = `600 42px ${DISPLAY}`;
  const lines = wrap(ctx, image.title, WIDTH - PAD * 2, 3);
  lines.forEach((line, i) => ctx.fillText(line, PAD, 150 + i * 54));
  let cursor = 150 + (lines.length - 1) * 54 + 40;

  ctx.fillStyle = COLORS.muted;
  ctx.font = `20px ${SANS}`;
  ctx.fillText(image.subtitle, PAD, cursor);
  cursor += 40;

  drawChart(ctx, image.series, image.slopePerStep, cursor, HEIGHT - 110);

  ctx.font = `14px ${SANS}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(image.source, PAD, HEIGHT - 40);
  ctx.fillStyle = COLORS.fg;
  ctx.fillText(
    image.footer,
    WIDTH - PAD - ctx.measureText(image.footer).width,
    HEIGHT - 40,
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not create image")),
      "image/png",
    ),
  );
}

export async function saveCaseImage(image: CaseImage) {
  const blob = await renderCaseImage(image);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = image.fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
