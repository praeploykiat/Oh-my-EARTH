import {useI18n} from '../../core/i18n';
import type {View} from '../../core/analysis';
import {TimeSeriesChart} from '../../shared';
import {prepareGlobalAnalysis,type YearRange} from './data';
import type {ExplorerRecord} from './explorerRecord';
import {co2Trend} from './co2Trend';
import {globalVariableByKey} from './variables';

export function Co2TrendChart({record,range,view,city}:{record:ExplorerRecord;range:YearRange;view:View;city:string}){
  const {t,language}=useI18n();
  const series=record.variables.XCO2!.series;
  const analysis=prepareGlobalAnalysis(series,'XCO2',range,view);
  const rate=co2Trend(series,range);
  return <article className="global-result">
    <div className="global-coverage"><strong>{range.start}–{range.end}</strong><span>{t('global.validMonths',{count:analysis.coverage.valid,total:analysis.coverage.total})}</span></div>
    <div className="card"><div className="card-header"><span>{globalVariableByKey('XCO2').label[language]} (ppm)</span><span>{t('global.co2.descriptive')}</span></div>
      <TimeSeriesChart series={analysis.shown} unit="ppm" timeLabel={view==='annual'?'year':'month'} slopePerStep={rate===null?undefined:rate/(view==='annual'?10:120)} height={260}/>
    </div>
    <section className="global-trend" aria-label={t('global.co2.descriptive')}><div className="global-insight" role="status">
      <h3>{t('global.co2.descriptive')} · {city}</h3>
      {rate===null?<p>{t('global.co2.minimum')}</p>:<><strong className="global-year-value">{rate>0?'+':''}{rate.toFixed(2)} <span>ppm / {t('global.map.decade')}</span></strong><p>{t('global.co2.rateNote',{start:range.start,end:range.end,years:range.end-range.start+1})}</p></>}
      <p>{t('global.co2.trendMethod')}</p><p>{t('global.co2.noInference')}</p>
    </div></section>
    <p className="global-aggregation-note">{t(view==='annual'?'global.meanAggregation':view==='anomaly'?'global.anomalyBaseline':'global.monthlyValues',{start:range.start,end:range.end})}</p>
    <p className="global-source"><a href={record.requestUrl} target="_blank" rel="noreferrer">{t('global.co2.source')}</a></p>
  </article>;
}
