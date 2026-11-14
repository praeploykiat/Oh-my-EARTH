import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { Axis } from './score';

const WIDTH = 680;
const HEIGHT = 340;
const PAD = { left: 60, right: 32, top: 24, bottom: 52 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const BOTTOM = PAD.top + PLOT_H;

const x = (month: number) => PAD.left + 18 + (month / 11) * (PLOT_W - 36);

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

function linePath(values: number[], y: (v: number) => number): string {
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
}

// Frame

interface FrameProps {
  axis: Axis;
  months: string[];
  title: string;
  label: string;
  children: ReactNode;
}

function Frame({ axis, months, title, label, children }: FrameProps) {
  const y = scaleY(axis);
  return (
    <>
      <text x={PAD.left - 8} y={PAD.top - 10} className="sketch-title">
        {title}
      </text>
      <g className="sketch-grid">
        {axis.ticks.slice(1).map((tick, i) => (
          <path key={tick} d={wobble(PAD.left, y(tick), WIDTH - PAD.right, y(tick), i + 1, 0.8)} />
        ))}
        {months.map((m, i) => (
          <path key={m} d={wobble(x(i), PAD.top, x(i), BOTTOM, i + 20, 0.8)} />
        ))}
      </g>
      <g className="sketch-ticks">
        {axis.ticks.map((tick) => (
          <text key={tick} x={PAD.left - 10} y={y(tick) + 4} textAnchor="end">
            {formatTick(tick)}
          </text>
        ))}
        {months.map((m, i) => (
          <text key={m} x={x(i)} y={BOTTOM + 20} textAnchor="middle">
            {m}
          </text>
        ))}
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
  values: number[];
  axis: Axis;
  months: string[];
  title: string;
  label: string;
}

export function GivenChart({ values, axis, months, title, label }: GivenChartProps) {
  const y = scaleY(axis);
  const barWidth = (PLOT_W / 12) * 0.5;
  return (
    <svg className="sketch" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title}>
      <Frame axis={axis} months={months} title={title} label={label}>
        {values.map((v, i) => (
          <rect key={i} x={x(i) - barWidth / 2} y={y(v)} width={barWidth} height={BOTTOM - y(v)} rx={4} className="sketch-bar" />
        ))}
      </Frame>
    </svg>
  );
}

// Drawing area

interface DrawChartProps {
  axis: Axis;
  months: string[];
  title: string;
  label: string;
  tip: string;
  hint: { month: number; value: number };
  guess: (number | null)[];
  onGuess: (guess: (number | null)[]) => void;
  actual: number[] | null;
  marks: { month: number; text: string }[];
}

export function DrawChart({ axis, months, title, label, tip, hint, guess, onGuess, actual, marks }: DrawChartProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState(false);
  const last = useRef<number | null>(null);
  const y = scaleY(axis);
  const locked = actual !== null;
  const started = guess.some((g, i) => g !== null && i !== hint.month);

  const place = (event: PointerEvent<SVGSVGElement>) => {
    const box = ref.current!.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * WIDTH;
    const py = ((event.clientY - box.top) / box.height) * HEIGHT;
    const month = Math.min(11, Math.max(0, Math.round(((px - PAD.left - 18) / (PLOT_W - 36)) * 11)));
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

  const points = guess.flatMap((g, i) => (g === null ? [] : [{ i, g }]));
  const guessPath = points.map((p, n) => `${n === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)} ${y(p.g).toFixed(1)}`).join(' ');
  const gap =
    actual && points.length === 12
      ? `${linePath(points.map((p) => p.g), y)} ${[...actual].reverse().map((v, i) => `L${x(11 - i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')} Z`
      : null;

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
      <Frame axis={axis} months={months} title={title} label={label}>
        {gap && <path d={gap} className="sketch-gap" />}
        {actual && <path d={linePath(actual, y)} className="sketch-actual" pathLength={1} />}
        {guessPath && <path d={guessPath} className="sketch-guess" />}
        {!started && !locked && (
          <g className="sketch-tip">
            <text x={x(hint.month) + 14} y={y(hint.value) + 32}>
              {tip}
            </text>
            <path d={`M${x(hint.month) + 12} ${y(hint.value) + 20}Q${x(hint.month) + 6} ${y(hint.value) + 14} ${x(hint.month) + 4} ${y(hint.value) + 8}`} />
          </g>
        )}
        <circle cx={x(hint.month)} cy={y(hint.value)} r={6} className="sketch-hint" />
        {actual &&
          marks.map((mark) => (
            <g key={mark.text} className="sketch-mark">
              <circle cx={x(mark.month)} cy={y(actual[mark.month])} r={5} />
              <text x={x(mark.month)} y={y(actual[mark.month]) - 12} textAnchor="middle">
                {mark.text}
              </text>
            </g>
          ))}
      </Frame>
    </svg>
  );
}
