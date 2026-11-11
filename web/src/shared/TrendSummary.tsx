import type { Dataset } from '../core/data';
import { useI18n, type MessageKey } from '../core/i18n';

interface TrendSummaryProps {
  dataset: Dataset;
}

export function TrendSummary({ dataset }: TrendSummaryProps) {
  const { t } = useI18n();
  const { slopePerDecade, pValue, significant, alpha } = dataset.trend;

  const directionKey: MessageKey = slopePerDecade > 0 ? 'trend.rising' : slopePerDecade < 0 ? 'trend.falling' : 'trend.flat';
  const pText = pValue < 0.001 ? t('trend.pBelow') : t('trend.pValue', { value: pValue.toFixed(3) });

  return (
    <div className={`trend-summary ${significant ? 'is-significant' : ''}`}>
      <strong>{t(directionKey, { value: Math.abs(slopePerDecade).toFixed(3), unit: dataset.unit })}</strong>
      <span>
        {pText} · {significant ? t('trend.significant', { alpha }) : t('trend.notSignificant')}
      </span>
      <small>
        {dataset.source.provider} · {dataset.source.product}
        {dataset.source.synthetic ? ` · ${t('trend.synthetic')}` : ''}
      </small>
    </div>
  );
}
