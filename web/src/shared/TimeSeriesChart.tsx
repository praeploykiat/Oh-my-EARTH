import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { SeriesPoint } from '../core/data';
import { decimalsFor } from '../core/analysis/format';
import { trendIntercept } from '../core/analysis/series';
import { useI18n } from '../core/i18n';
import { chartPaths } from './chartPaths';

export interface ChartBand {
  from: number;
  to: number;
  value: number;
  label: string;
}

interface TimeSeriesChartProps {
  series: SeriesPoint[];
  unit: string;
  slopePerStep?: number;
  bands?: ChartBand[];
  height?: number;
}

const PADDING = { top: 20, right: 20, bottom: 32, left: 52 };
const TICK_COUNT = 4;

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

function niceTicks(min: number, max: number, count: number): number[] {
  const step = (max - min) / (count - 1 || 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

export function TimeSeriesChart({ series, unit, slopePerStep, bands = [], height = 300 }: TimeSeriesChartProps) {
  const { t } = useI18n();
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const values = useMemo(() => series.map((p) => p.value).filter((v): v is number => v !== null), [series]);

  if (values.length === 0) return <p className="status">{t('chart.noData')}</p>;

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = rawMin === rawMax ? Math.abs(rawMin) * 0.05 || 1 : 0;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min || 1;
  const plotWidth = Math.max(width - PADDING.left - PADDING.right, 0);
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const bottom = PADDING.top + plotHeight;
  const ticks = niceTicks(min, max, TICK_COUNT);
  const tickDecimals = decimalsFor(ticks.length > 1 ? ticks[1] - ticks[0] : span);

  const x = (i: number) => PADDING.left + (series.length === 1 ? 0.5 : i / (series.length - 1)) * plotWidth;
  const y = (v: number) => PADDING.top + (1 - (v - min) / span) * plotHeight;

  const paths = chartPaths(series, x, y, bottom);

  const yearLabelEvery = Math.max(1, Math.round(series.length / Math.max(2, Math.floor(plotWidth / 90))));
  const intercept = slopePerStep === undefined ? null : trendIntercept(series, slopePerStep);

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left - PADDING.left) / (plotWidth || 1);
    const index = Math.round(ratio * (series.length - 1));
    setHoverIndex(index >= 0 && index < series.length ? index : null);
  };

  const hovered = hoverIndex === null ? null : series[hoverIndex];

  return (
    <div className="chart" ref={containerRef}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={t('chart.label', { unit })}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--data)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--data)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((v) => (
            <g key={v}>
              <line x1={PADDING.left} x2={PADDING.left + plotWidth} y1={y(v)} y2={y(v)} className="chart-grid" />
              <text x={PADDING.left - 8} y={y(v)} className="chart-label" textAnchor="end" dominantBaseline="middle">
                {v.toFixed(tickDecimals)}
              </text>
            </g>
          ))}

          {series.map((p, i) =>
            i % yearLabelEvery === 0 ? (
              <text key={p.t} x={x(i)} y={height - 10} className="chart-label" textAnchor="middle">
                {p.t.slice(0, 4)}
              </text>
            ) : null,
          )}

          {min < 0 && max > 0 && (
            <line x1={PADDING.left} x2={PADDING.left + plotWidth} y1={y(0)} y2={y(0)} className="chart-zero" />
          )}

          <path d={paths.area} fill="url(#chart-area)" />
          <path d={paths.line} className="chart-line" />
          {paths.isolated.map((i) => <circle key={series[i].t} cx={x(i)} cy={y(series[i].value!)} r={3.5} fill="var(--data)" />)}

          {bands.map((band) => (
            <g key={band.label} className="chart-band">
              <line x1={x(band.from)} x2={x(band.to)} y1={y(band.value)} y2={y(band.value)} />
              <text x={(x(band.from) + x(band.to)) / 2} y={y(band.value) - 8} textAnchor="middle">
                {band.label}
              </text>
            </g>
          ))}

          {intercept !== null && slopePerStep !== undefined && (
            <line
              x1={x(0)}
              y1={y(intercept)}
              x2={x(series.length - 1)}
              y2={y(intercept + slopePerStep * (series.length - 1))}
              className="chart-trend"
            />
          )}

          {hovered && hovered.value !== null && hoverIndex !== null && (
            <g className="chart-hover">
              <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={PADDING.top} y2={bottom} />
              <circle cx={x(hoverIndex)} cy={y(hovered.value)} r={4} />
            </g>
          )}
        </svg>
      )}

      {hovered && hovered.value !== null && (
        <div className="chart-tooltip">
          <span>{hovered.t}</span>
          <strong>
            {hovered.value.toFixed(tickDecimals + 1)} {unit}
          </strong>
        </div>
      )}
    </div>
  );
}
