import type { SeriesPoint } from '../core/data';
import { useI18n } from '../core/i18n';

interface TimeSeriesChartProps {
  series: SeriesPoint[];
  unit: string;
  height?: number;
}

const WIDTH = 720;
const PADDING = { top: 16, right: 16, bottom: 28, left: 48 };

export function TimeSeriesChart({ series, unit, height = 260 }: TimeSeriesChartProps) {
  const { t } = useI18n();
  const values = series.map((p) => p.value).filter((v): v is number => v !== null);
  if (values.length === 0) return <p>{t('chart.noData')}</p>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;

  const x = (i: number) => PADDING.left + (i / Math.max(series.length - 1, 1)) * plotWidth;
  const y = (v: number) => PADDING.top + (1 - (v - min) / span) * plotHeight;

  const path = series
    .map((p, i) => (p.value === null ? null : `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`))
    .filter(Boolean)
    .join(' L ');

  const yTicks = [min, min + span / 2, max];
  const xTickEvery = Math.max(1, Math.round(series.length / 6));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="chart" role="img" aria-label={`Time series in ${unit}`}>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y(v)} y2={y(v)} className="chart-grid" />
          <text x={PADDING.left - 6} y={y(v)} className="chart-label" textAnchor="end" dominantBaseline="middle">
            {v.toFixed(1)}
          </text>
        </g>
      ))}
      {series.map((p, i) =>
        i % xTickEvery === 0 ? (
          <text key={p.t} x={x(i)} y={height - 8} className="chart-label" textAnchor="middle">
            {p.t.slice(0, 4)}
          </text>
        ) : null,
      )}
      <path d={`M ${path}`} className="chart-line" />
    </svg>
  );
}
