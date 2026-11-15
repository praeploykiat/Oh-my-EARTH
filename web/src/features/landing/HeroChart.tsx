import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useI18n } from '../../core/i18n';

export interface YearPoint {
  year: number;
  value: number;
}

interface HeroChartProps {
  points: YearPoint[];
  split: number;
  unit: string;
  revealed: boolean;
  guess: (number | null)[];
  onGuess: (guess: (number | null)[]) => void;
  note?: { index: number; text: string } | null;
}

const WIDE = { w: 800, h: 360 };
const NARROW = { w: 420, h: 340 };
const NARROW_QUERY = '(max-width: 760px)';

// Phones get a narrower, taller drawing so labels and lines stay readable
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return narrow;
}
const PAD = { left: 48, right: 24, top: 24, bottom: 40 };

// Fill unset years between drawn ones so the line has no holes

export function fillGuess(guess: (number | null)[], start: number): (number | null)[] {
  const out = [...guess];
  let last = start;
  let lastIndex = -1;
  for (let i = 0; i < out.length; i++) {
    if (out[i] === null) continue;
    for (let j = lastIndex + 1; j < i; j++) {
      const share = (j - lastIndex) / (i - lastIndex);
      out[j] = last + (out[i]! - last) * share;
    }
    last = out[i]!;
    lastIndex = i;
  }
  return out;
}

// A hand-written prompt in the empty part, with an arrow to where drawing starts

function Hint({ from, right, narrow }: { from: [number, number]; right: number; narrow: boolean }) {
  const { t } = useI18n();
  const top = PAD.top + (narrow ? 34 : 56);
  const gap = narrow ? 26 : 38;
  const start: [number, number] = [right - (narrow ? 90 : 150), top + gap + 14];
  const end: [number, number] = [from[0] + 14, from[1] - 14];
  const control: [number, number] = [start[0] - 40, (start[1] + end[1]) / 2 - 20];
  const angle = Math.atan2(end[1] - control[1], end[0] - control[0]);
  const head = (turn: number) => `${end[0] - 14 * Math.cos(angle + turn)},${end[1] - 14 * Math.sin(angle + turn)}`;
  return (
    <g className="hero-chart-hint" aria-hidden="true">
      <text x={right} y={top} textAnchor="end">
        {t('landing.drawHint')}
      </text>
      <text x={right} y={top + gap} textAnchor="end" className="hero-chart-hint-small">
        {t('landing.drawHint2')}
      </text>
      <path d={`M${start[0]},${start[1]} Q${control[0]},${control[1]} ${end[0]},${end[1]}`} />
      <path d={`M${head(0.5)} L${end[0]},${end[1]} L${head(-0.5)}`} />
    </g>
  );
}

export function HeroChart({ points, split, unit, revealed, guess, onGuess, note }: HeroChartProps) {
  const { t } = useI18n();
  const svg = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState(false);
  const narrow = useNarrow();
  const { w: W, h: H } = narrow ? NARROW : WIDE;

  const { x, y, ticks } = useMemo(() => {
    const values = points.map((p) => p.value);
    const low = Math.floor(Math.min(...values) - 0.6);
    const high = Math.ceil(Math.max(...values) + 0.6);
    const xs = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
    const ys = (v: number) => PAD.top + ((high - v) / (high - low)) * (H - PAD.top - PAD.bottom);
    const step = high - low > 4 ? 1 : 0.5;
    const list: number[] = [];
    for (let v = low; v <= high + 1e-9; v += step) list.push(Math.round(v * 10) / 10);
    return { x: xs, y: ys, ticks: list, low, high };
  }, [points, W, H]);

  const known = points.slice(0, split);
  const hidden = points.slice(split);
  const startValue = known[known.length - 1].value;

  const path = (pts: [number, number][]) => pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('');

  const valueAt = (clientY: number) => {
    const box = svg.current!.getBoundingClientRect();
    const sy = ((clientY - box.top) / box.height) * H;
    const low = ticks[0];
    const high = ticks[ticks.length - 1];
    const v = high - ((sy - PAD.top) / (H - PAD.top - PAD.bottom)) * (high - low);
    return Math.min(high, Math.max(low, v));
  };

  const indexAt = (clientX: number) => {
    const box = svg.current!.getBoundingClientRect();
    const sx = ((clientX - box.left) / box.width) * W;
    const i = Math.round(((sx - PAD.left) / (W - PAD.left - PAD.right)) * (points.length - 1));
    return i - split;
  };

  const place = (event: PointerEvent<SVGSVGElement>) => {
    const i = indexAt(event.clientX);
    if (i < 0 || i >= hidden.length) return;
    const next = [...guess];
    next[i] = valueAt(event.clientY);
    onGuess(next);
  };

  const filled = fillGuess(guess, startValue);
  const guessPts: [number, number][] = [[x(split - 1), y(startValue)]];
  filled.forEach((v, i) => v !== null && guessPts.push([x(split + i), y(v)]));

  return (
    <svg
      ref={svg}
      className={`hero-chart ${revealed ? 'is-revealed' : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={t('landing.chartLabel')}
      onPointerDown={(event) => {
        if (revealed) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrawing(true);
        place(event);
      }}
      onPointerMove={(event) => drawing && !revealed && place(event)}
      onPointerUp={() => setDrawing(false)}
      onPointerCancel={() => setDrawing(false)}
    >
      <rect className="hero-chart-future" x={x(split - 1)} y={PAD.top} width={x(points.length - 1) - x(split - 1)} height={H - PAD.top - PAD.bottom} />

      {ticks.map((v) => (
        <g key={v}>
          <line className="hero-chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
          <text className="hero-chart-tick" x={PAD.left - 8} y={y(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {points.map((p, i) =>
        i % 4 === 0 || i === points.length - 1 ? (
          <text key={p.year} className="hero-chart-tick" x={x(i)} y={H - PAD.bottom + 22} textAnchor="middle">
            {p.year}
          </text>
        ) : null,
      )}
      <text className="hero-chart-unit" x={PAD.left} y={PAD.top - 8}>
        {unit}
      </text>

      <path className="hero-chart-known" d={path(known.map((p, i) => [x(i), y(p.value)]))} />
      {known.map((p, i) => (
        <circle key={p.year} className="hero-chart-dot" cx={x(i)} cy={y(p.value)} r={3.5} />
      ))}

      {guessPts.length > 1 && <path className="hero-chart-guess" d={path(guessPts)} />}

      {revealed && (
        <path
          className="hero-chart-real"
          pathLength={1}
          d={path([[x(split - 1), y(startValue)], ...hidden.map((p, i): [number, number] => [x(split + i), y(p.value)])])}
        />
      )}

      {note && (
        <g className="hero-chart-note">
          <circle cx={x(note.index)} cy={y(points[note.index].value)} r={9} />
          <text x={x(note.index) - 14} y={y(points[note.index].value) - 16} textAnchor="end">
            {note.text}
          </text>
        </g>
      )}

      {!revealed && guessPts.length === 1 && <Hint from={[x(split - 1), y(startValue)]} right={W - PAD.right - 8} narrow={narrow} />}
    </svg>
  );
}
