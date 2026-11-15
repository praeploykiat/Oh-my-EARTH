import { useI18n } from '../../core/i18n';
import type { GlobalTrendResult } from '../../core/stats/globalTrend';

export function GlobalTrendSummary({ result, unit, variable, city, start, end }: { result: GlobalTrendResult; unit: string; variable: string; city: string; start: number; end: number }) {
  const { t, language } = useI18n();
  const number = (v: number) => v !== 0 && Math.abs(v) < 0.001 ? v.toExponential(2) : v.toLocaleString(language === 'th' ? 'th-TH' : 'en-GB', { maximumFractionDigits: 3, minimumFractionDigits: 2 });
  const direction = result.slopePerDecade > 0 ? 'global.trend.up' : result.slopePerDecade < 0 ? 'global.trend.down' : 'global.trend.flat';
  const seasons = result.seasonalSlopesPerDecade.filter((v): v is number => v !== null);
  const changedSign = seasons.some((v) => v < 0) && seasons.some((v) => v > 0);
  return <section className="global-trend" aria-label={t('global.trend.title')}>
    <div className="global-insight" role="status">
      <h3>{t('global.trend.title')}</h3>
      <p>{t(direction, { variable, city, rate: number(Math.abs(result.slopePerDecade)), unit, start, end })}</p>
      <p>{t(`global.trend.${result.evidence}`)}</p>
      {result.warnings.map((warning) => <p key={warning} className="global-trend-warning">{t(`global.trend.warning.${warning}`)}</p>)}
      <p>{t('global.trend.intervalExplanation', { lower: number(result.lowerPerDecade), upper: number(result.upperPerDecade), unit })}</p>
    </div>
    <div className="stats">
      <div className="stat"><span className="stat-label">{t('stats.trend')}</span><strong className="stat-value">{result.slopePerDecade > 0 ? '+' : ''}{number(result.slopePerDecade)}</strong><span className="stat-unit">{t('stats.perDecade', { unit })}</span></div>
      <div className="stat"><span className="stat-label">{t('global.trend.interval')}</span><strong className="stat-value stat-value-text">{number(result.lowerPerDecade)} – {number(result.upperPerDecade)}</strong><span className="stat-unit">{t('stats.perDecade', { unit })}</span></div>
      <div className="stat"><span className="stat-label">{t('global.trend.pValue')}</span><strong className="stat-value">{result.pValue.toFixed(3)}</strong><span className="stat-unit">{t('global.trend.testName')}</span></div>
    </div>
    <details className="global-trend-details"><summary>{t('global.trend.diagnostics')}</summary>
      <p>{t(result.period === 12 ? 'global.trend.seasonalMethod' : 'global.trend.annualMethod')}</p>
      <p>{t('global.trend.bootstrap', { count: result.replicates, years: result.blockYears })}</p>
      <p>{t('global.trend.lag1', { value: result.lag1 === null ? t('global.trend.undefined') : number(result.lag1) })}</p>
      {result.period === 12 && <><p>{t('global.trend.monthRange', { lower: number(Math.min(...seasons)), upper: number(Math.max(...seasons)), unit })}</p>{changedSign && <p>{t('global.trend.opposingMonths')}</p>}</>}
      <div className="global-quality-scroll"><table><caption>{t('global.trend.sensitivity')}</caption><thead><tr><th scope="col">{t('global.trend.blockYears')}</th><th scope="col">{t('global.trend.pValue')}</th><th scope="col">{t('global.trend.interval')} ({t('stats.perDecade', { unit })})</th></tr></thead><tbody>
        {result.sensitivity.map((sample) => <tr key={sample.blockYears}><th scope="row">{sample.blockYears}{sample.blockYears === result.blockYears ? ' *' : ''}</th><td>{sample.pValue.toFixed(3)}</td><td>{number(sample.lowerPerDecade)} – {number(sample.upperPerDecade)}</td></tr>)}
      </tbody></table></div>
      <p>{t('global.trend.primaryNote')}</p><p>{t('global.trend.version', { method: result.method, seed: result.seed })}</p>
      <a href="https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mstats.sen_seasonal_slopes.html" target="_blank" rel="noreferrer">{t('global.trend.reference')}</a>
    </details>
  </section>;
}
