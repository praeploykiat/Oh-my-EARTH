import { slopeDecimals } from '../core/analysis/format';
import type { Dataset } from '../core/data';
import { useI18n } from '../core/i18n';
import { InfoTip } from './InfoTip';

interface TrendSummaryProps {
  dataset: Dataset;
}

function recordSpan(dataset: Dataset) {
  return {
    from: dataset.series[0]?.t.slice(0, 4) ?? '',
    to: dataset.series[dataset.series.length - 1]?.t.slice(0, 4) ?? '',
  };
}

export function TrendSummary({ dataset }: TrendSummaryProps) {
  const { t } = useI18n();
  const { slopePerDecade, pValue, significant, alpha } = dataset.trend;
  const sign = slopePerDecade > 0 ? '+' : slopePerDecade < 0 ? '−' : '';

  return (
    <div className="stats">
      <div className={`stat ${significant ? 'is-highlight' : ''}`}>
        <span className="stat-label">
          {t('stats.trend')} <InfoTip text={t('info.trend')} />
        </span>
        <strong className="stat-value">
          {sign}
          {Math.abs(slopePerDecade).toFixed(slopeDecimals(dataset.series))}
        </strong>
        <span className="stat-unit">{t('stats.perDecade', { unit: dataset.unit })}</span>
      </div>

      <div className="stat">
        <span className="stat-label">
          {t('stats.pValue')} <InfoTip text={t('info.pValue')} />
        </span>
        <strong className="stat-value">{pValue < 0.001 ? '<0.001' : pValue.toFixed(3)}</strong>
        <span className="stat-unit">{t('stats.mannKendall')}</span>
      </div>

      <div className="stat">
        <span className="stat-label">
          {t('stats.verdict')} <InfoTip text={t('info.verdict')} />
        </span>
        <strong className="stat-value stat-value-text">
          {significant ? t('stats.significant') : t('stats.notSignificant')}
        </strong>
        <span className="stat-unit">α = {alpha}</span>
      </div>

      <div className="stat">
        <span className="stat-label">{t('stats.record')}</span>
        <strong className="stat-value stat-value-text">{t('range', recordSpan(dataset))}</strong>
        <span className="stat-unit">{t('stats.points', { count: dataset.series.length })}</span>
      </div>
    </div>
  );
}
