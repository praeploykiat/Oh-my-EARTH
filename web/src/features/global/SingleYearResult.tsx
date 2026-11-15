import { isWaterFlux } from './data';
import { useMemo } from 'react';
import { globalVariableByKey as variableByKey,sourceLabel } from './variables';
import { useI18n } from '../../core/i18n';
import { TimeSeriesChart } from '../../shared';
import type { GlobalVariable } from './data';
import { mapModeLabel, mapUnit, yearSummary, type MapMode } from './mapData';
import type { ExplorerRecord } from './explorerRecord';

export function SingleYearResult({ record, variable, mode, year, city }: { record: ExplorerRecord; variable: GlobalVariable; mode: Exclude<MapMode, 'trend'>; year: number; city: string }) {
  const { t, language } = useI18n();
  const summary = useMemo(() => yearSummary(record, variable, year, mode), [record, variable, year, mode]);
  const definition = variableByKey(variable)!;
  const unit = mapUnit(variable, mode, definition.unit, true);
  const monthlyUnit = isWaterFlux(variable) ? 'mm/month' : definition.unit;
  const months = summary.months.map((month) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString(language === 'th' ? 'th-TH-u-ca-gregory' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })).join(', ');
  return <article className="global-result global-year-result">
    <div className="global-coverage"><strong>{year}</strong><span>{t('global.validMonths', { count: summary.coverage.valid, total: summary.coverage.total })}</span></div>
    <div className="global-year-summary" role="status">
      <h3>{t(mapModeLabel(mode, variable))} · {city} · {year}</h3>
      {summary.value === null ? <p>{t('global.map.yearIncomplete')}</p> : <>
        <strong className="global-year-value">{summary.value.toFixed(2)} <span>{unit}</span></strong>
        {months && <p>{months}</p>}
      </>}
      <p>{t(variable==='EVAPOTRANSPIRATION'?'global.giovanni.etNote':variable === 'NDVI' ? mode === 'average' ? 'global.ndvi.meanNote' : 'global.ndvi.extremeNote' : mode === 'average' ? isWaterFlux(variable) ? 'global.map.rainNote' : 'global.map.meanNote' : isWaterFlux(variable) ? 'global.map.rainExtremeNote' : 'global.map.extremeNote')}</p>
    </div>
    <div className="card"><div className="card-header"><span>{definition.label[language]} · {year} ({monthlyUnit})</span><span>{t('global.map.monthlyChart')}</span></div>
      <TimeSeriesChart series={summary.monthly} unit={monthlyUnit} height={260} timeLabel="month" highlightDates={summary.months} />
    </div>
    <p className="global-aggregation-note">{t('global.map.yearChartNote')}</p>
    <p className="global-source"><a href={record.requestUrl} target="_blank" rel="noreferrer">{t(sourceLabel(variable))}</a></p>
    <p className="global-caution">{t('global.caution')}</p>
  </article>;
}
