"""Generate independent SciPy references for descriptive CO2 slopes; no inference."""
import json
from pathlib import Path
import numpy as np
import scipy
from scipy.stats.mstats import sen_seasonal_slopes
from src.observations import ROOT


def main():
    cache=ROOT/'web/public/co2-cache'
    manifest=json.loads((cache/'manifest.json').read_text())
    cases=[]
    for ref in manifest['capitals']:
        record=json.loads((cache/ref['path']).read_text())
        ranges=[(2015,2021)]
        if ref['code'] in ['TH','NO','AU','MV']:
            ranges.extend([(2015,2017),(2017,2021),(2019,2021),(2016,2020)])
        for start,end in ranges:
            values=[p['value'] for p in record['series'] if start<=int(p['t'][:4])<=end]
            array=np.asarray(values,dtype=float).reshape(end-start+1,12)
            slope=float(sen_seasonal_slopes(array).inter_slope)*10
            cases.append({'code':ref['code'],'start':start,'end':end,'ppmPerDecade':slope})
    result={'sourceReleaseId':manifest['releaseId'],'method':'scipy.stats.mstats.sen_seasonal_slopes.inter_slope * 10','scipyVersion':scipy.__version__,'cases':cases,'inference':'No confidence intervals, significance tests or forecasts.'}
    path=ROOT/'web/src/features/global/fixtures/co2-seasonal-slopes.json'
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'independentReferenceCases':len(cases),'scipyVersion':scipy.__version__}))


if __name__=='__main__':main()
