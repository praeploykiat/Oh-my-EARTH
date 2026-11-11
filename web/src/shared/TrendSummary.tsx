import type { Dataset } from '../core/data';

interface TrendSummaryProps {
  dataset: Dataset;
}

export function TrendSummary({ dataset }: TrendSummaryProps) {
  const { slopePerDecade, pValue, significant, alpha } = dataset.trend;
  const direction = slopePerDecade > 0 ? 'Rising' : slopePerDecade < 0 ? 'Falling' : 'Flat';

  return (
    <div className={`trend-summary ${significant ? 'is-significant' : ''}`}>
      <strong>
        {direction} {Math.abs(slopePerDecade).toFixed(3)} {dataset.unit} per decade
      </strong>
      <span>
        {pValue < 0.001 ? 'p < 0.001' : `p = ${pValue.toFixed(3)}`} ·{' '}
        {significant ? `significant at α = ${alpha}` : 'not significant'}
      </span>
      <small>
        {dataset.source.provider} · {dataset.source.product}
        {dataset.source.synthetic ? ' · synthetic sample data' : ''}
      </small>
    </div>
  );
}
