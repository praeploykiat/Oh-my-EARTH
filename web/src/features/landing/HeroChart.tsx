import { useMemo, useRef, useState, type PointerEvent } from 'react';
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

const W = 800;
const H = 360;
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

export function HeroChart({ points, split, unit, revealed, guess, onGuess, note }: HeroChartProps) {
  const { t } = useI18n();
  const svg = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState(false);

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
  }, [points]);

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

      {!revealed && guessPts.length === 1 && (
        <text className="hero-chart-hint" x={(x(split) + x(points.length - 1)) / 2} y={(PAD.top + H - PAD.bottom) / 2} textAnchor="middle">
          {t('landing.drawHint')}
        </text>
      )}
    </svg>
  );
}
