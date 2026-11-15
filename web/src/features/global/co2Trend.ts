import type { SeriesPoint } from '../../core/data';
import { completeMonthlyRecord, type YearRange } from './data';

// Descriptive only: median of all matching-calendar-month pairwise slopes.
// Same point estimator as scipy.stats.mstats.sen_seasonal_slopes().inter_slope.
// A rate expressed per decade does not require or imply ten observed years.
export function co2Trend(series: SeriesPoint[], range: YearRange): number | null {
  if(!Number.isInteger(range.start)||!Number.isInteger(range.end)||range.start<2015||range.end>2021||range.end<range.start)throw new Error('Invalid CO2 trend period');
  const years=range.end-range.start+1;
  if(years<3)return null;
  const monthly=completeMonthlyRecord(series,range);
  if(monthly.some(p=>p.value===null || !Number.isFinite(p.value)))return null;
  const slopes:number[]=[];
  for(let month=0;month<12;month++)for(let a=0;a<years;a++)for(let b=a+1;b<years;b++)
    slopes.push((monthly[b*12+month].value!-monthly[a*12+month].value!)/(b-a));
  slopes.sort((a,b)=>a-b);
  const middle=Math.floor(slopes.length/2);
  return (slopes.length%2?slopes[middle]:(slopes[middle-1]+slopes[middle])/2)*10;
}
