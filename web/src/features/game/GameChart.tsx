import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { Axis } from './score';

const WIDTH = 680;
const HEIGHT = 340;
const PAD = { left: 60, right: 32, top: 24, bottom: 52 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const BOTTOM = PAD.top + PLOT_H;

const x = (i: number, n: number) => PAD.left + 18 + (n > 1 ? i / (n - 1) : 0.5) * (PLOT_W - 36);
const labelStep = (n: number) => Math.ceil(n / 12);

function scaleY(axis: Axis) {
  return (value: number) => BOTTOM - ((value - axis.min) / (axis.max - axis.min || 1)) * PLOT_H;
}

function formatTick(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// Hand drawn lines

function wobble(x1: number, y1: number, x2: number, y2: number, seed: number, amount = 1.4): string {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(2, Math.round(length / 24));
  const nx = -(y2 - y1) / length;
  const ny = (x2 - x1) / length;
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const edge = i === 0 || i === steps ? 0 : 1;
    const shift = edge * amount * Math.sin(seed * 12.9898 + i * 2.3) * Math.cos(seed * 4.1 + i * 1.7);
    return [x1 + (x2 - x1) * t + nx * shift, y1 + (y2 - y1) * t + ny * shift];
  });
  return points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
}

function linePath(values: (number | null)[], y: (v: number) => number): string {
  let pen = 'M';
  return values
    .map((v, i) => {
      if (v === null) {
        pen = 'M';
        return '';
      }
      const step = `${pen}${x(i, values.length).toFixed(1)} ${y(v).toFixed(1)}`;
      pen = 'L';
      return step;
    })
    .join(' ');
}

// Frame

interface FrameProps {
  axis: Axis;
  times: string[];
  title: string;
  label: string;
  children: ReactNode;
}

function Frame({ axis, times, title, label, children }: FrameProps) {
  const y = scaleY(axis);
  const n = times.length;
  const every = labelStep(n);
  return (
    <>
      <text x={PAD.left - 8} y={PAD.top - 10} className="sketch-title">
        {title}
      </text>
      <g className="sketch-grid">
        {axis.ticks.slice(1).map((tick, i) => (
          <path key={tick} d={wobble(PAD.left, y(tick), WIDTH - PAD.right, y(tick), i + 1, 0.8)} />
        ))}
        {times.map((t, i) =>
          i % every === 0 ? <path key={`${t}-${i}`} d={wobble(x(i, n), PAD.top, x(i, n), BOTTOM, i + 20, 0.8)} /> : null,
        )}
      </g>
      <g className="sketch-ticks">
        {axis.ticks.map((tick) => (
          <text key={tick} x={PAD.left - 10} y={y(tick) + 4} textAnchor="end">
            {formatTick(tick)}
          </text>
        ))}
        {times.map((t, i) =>
          i % every === 0 ? (
            <text key={`${t}-${i}`} x={x(i, n)} y={BOTTOM + 20} textAnchor="middle">
              {t}
            </text>
          ) : null,
        )}
      </g>
      <g className="sketch-axis">
        <path d={wobble(PAD.left, BOTTOM, PAD.left, PAD.top - 2, 7)} />
        <path d={`M${PAD.left - 5} ${PAD.top + 6}L${PAD.left} ${PAD.top - 3}L${PAD.left + 5} ${PAD.top + 6}`} />
        <path d={wobble(PAD.left, BOTTOM, WIDTH - PAD.right + 6, BOTTOM, 3)} />
        <path d={`M${WIDTH - PAD.right - 3} ${BOTTOM - 5}L${WIDTH - PAD.right + 6} ${BOTTOM}L${WIDTH - PAD.right - 3} ${BOTTOM + 5}`} />
      </g>
      <text x={PAD.left + PLOT_W / 2} y={HEIGHT - 6} textAnchor="middle" className="sketch-label">
        {label}
      </text>
      {children}
    </>
  );
}

// Given variable

interface GivenChartProps {
  values: (number | null)[];
  axis: Axis;
  times: string[];
  title: string;
  label: string;
}

export function GivenChart({ values, axis, times, title, label }: GivenChartProps) {
  const y = scaleY(axis);
  const n = values.length;
  const barWidth = Math.max(2, ((PLOT_W - 36) / n) * 0.55);
  return (
    <svg className="sketch" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title}>
      <Frame axis={axis} times={times} title={title} label={label}>
        {values.map((v, i) =>
          v === null ? null : (
            <rect key={i} x={x(i, n) - barWidth / 2} y={y(v)} width={barWidth} height={Math.max(0, BOTTOM - y(v))} rx={Math.min(4, barWidth / 2)} className="sketch-bar" />
          ),
        )}
      </Frame>
    </svg>
  );
}

// Drawing area

interface DrawChartProps {
  axis: Axis;
  times: string[];
  title: string;
  label: string;
  tip: string;
  guess: (number | null)[];
  onGuess: (guess: (number | null)[]) => void;
  actual: (number | null)[] | null;
  marks: { index: number; text: string }[];
  shown?: (number | null)[];
  from?: number;
}

// shown and from turn this into continue-the-line: values before `from` are given, players draw the rest

export function DrawChart({ axis, times, title, label, tip, guess, onGuess, actual, marks, shown, from: drawFrom = 0 }: DrawChartProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState(false);
  const last = useRef<number | null>(null);
  const y = scaleY(axis);
  const n = guess.length;
  const locked = actual !== null;
  const started = guess.some((g) => g !== null);

  const place = (event: PointerEvent<SVGSVGElement>) => {
    const box = ref.current!.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * WIDTH;
    const py = ((event.clientY - box.top) / box.height) * HEIGHT;
    const month = Math.min(n - 1, Math.max(drawFrom, Math.round(((px - PAD.left - 18) / (PLOT_W - 36)) * (n - 1))));
    const share = Math.min(1, Math.max(0, (BOTTOM - py) / PLOT_H));
    const value = axis.min + share * (axis.max - axis.min);
    const next = [...guess];
    const from = last.current;
    if (from !== null && from !== month && next[from] !== null) {
      const step = month > from ? 1 : -1;
      for (let i = from + step; i !== month; i += step) {
        next[i] = next[from]! + ((i - from) / (month - from)) * (value - next[from]!);
      }
    }
    next[month] = value;
    last.current = month;
    onGuess(next);
  };

  const points = guess.flatMap((g, i) => (g === null || i < drawFrom ? [] : [{ i, g }]));
  const anchor = drawFrom > 0 && shown && shown[drawFrom - 1] !== null ? { i: drawFrom - 1, g: shown[drawFrom - 1]! } : null;
  const drawn = anchor && points.length ? [anchor, ...points] : points;
  const guessPath = drawn.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i, n).toFixed(1)} ${y(p.g).toFixed(1)}`).join(' ');
  const complete = actual && points.length === n - drawFrom && points.every((p) => actual[p.i] !== null);
  const gap = complete
    ? `${points.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i, n).toFixed(1)} ${y(p.g).toFixed(1)}`).join(' ')} ${[...points]
        .reverse()
        .map((p) => `L${x(p.i, n).toFixed(1)} ${y(actual![p.i]!).toFixed(1)}`)
        .join(' ')} Z`
    : null;
  const future = drawFrom > 0 ? x(drawFrom - 1, n) : null;
  const tipX = future === null ? PAD.left + PLOT_W / 2 : (future + WIDTH - PAD.right) / 2;

  return (
    <svg
      ref={ref}
      className={`sketch sketch-draw ${locked ? 'is-locked' : ''}`}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={title}
      onPointerDown={(event) => {
        if (locked) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        last.current = null;
        setDrawing(true);
        place(event);
      }}
      onPointerMove={(event) => drawing && !locked && place(event)}
      onPointerUp={() => setDrawing(false)}
      onPointerCancel={() => setDrawing(false)}
    >
      <Frame axis={axis} times={times} title={title} label={label}>
        {future !== null && <rect x={future} y={PAD.top} width={WIDTH - PAD.right - future} height={PLOT_H} className="sketch-future" />}
        {shown && <path d={linePath(shown.map((v, i) => (i < drawFrom ? v : null)), y)} className="sketch-known" />}
        {shown &&
          shown.map((v, i) => (i < drawFrom && v !== null ? <circle key={i} cx={x(i, n)} cy={y(v)} r={3.5} className="sketch-known-dot" /> : null))}
        {gap && <path d={gap} className="sketch-gap" />}
        {actual && <path d={linePath(actual, y)} className="sketch-actual" pathLength={1} />}
        {guessPath && <path d={guessPath} className="sketch-guess" />}
        {!started && !locked && (
          <text x={tipX} y={PAD.top + PLOT_H / 2} textAnchor="middle" className="sketch-tip">
            {tip}
          </text>
        )}
        {actual &&
          marks.map((mark) =>
            actual[mark.index] === null ? null : (
              <g key={mark.text} className="sketch-mark">
                <circle cx={x(mark.index, n)} cy={y(actual[mark.index]!)} r={5} />
                <text x={x(mark.index, n)} y={y(actual[mark.index]!) - 12} textAnchor="middle">
                  {mark.text}
                </text>
              </g>
            ),
          )}
      </Frame>
    </svg>
  );
}
