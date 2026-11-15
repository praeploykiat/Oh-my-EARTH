"""Opt-in live multi-capital GLDAS validation. Does not import or publish data."""
import argparse
import json
import hashlib
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
from pathlib import Path
from src.observations import ROOT,catalog,gldas_batch
from src.gldas import fetch_csv,parse_csv


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--resume',action='store_true');args=parser.parse_args()
    directory=ROOT/'pipeline/raw/gldas-validation';directory.mkdir(parents=True,exist_ok=True)
    sample=['TH','EG','NO','AU','BR','CA','KE','MV']
    points={c['code']:c for c in catalog()}
    def check(code):
        path=directory/f'{code}.json';point=points[code]
        try:
            if args.resume and path.exists():data=json.loads(path.read_text(encoding='utf-8'))
            else:
                data={'requested':point,'retrievedAt':datetime.now(timezone.utc).isoformat(),'csv':fetch_csv(point)}
                path.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
            doc=gldas_batch(path);parsed=parse_csv(data['csv'],point)
            values=[r['value'] for r in doc['observations'] if r['value'] is not None]
            complete=sum(all(p['value'] is not None for p in parsed['series'][i:i+12]) for i in range(0,288,12))
            return {'code':code,'capital':point['city'],'requested':{'lat':point['lat'],'lon':point['lon']},'responseCoordinates':parsed['responseCoordinates'],
              'status':'PASS','months':288,'sourceRows':parsed['sourceRows'],'valid':len(values),'missing':len(parsed['missing']),'rejected':len(parsed['rejected']),
              'minimum':min(values) if values else None,'maximum':max(values) if values else None,'completeYears':complete,
              'trendCoverageGate':len(values)>=.8*288 and complete>=10,'unit':doc['observations'][0]['unit'],'artifactSha256':doc['artifact']['sha256'],
              'seriesSha256':hashlib.sha256(json.dumps([p['value'] for p in parsed['series']]).encode()).hexdigest()}
        except Exception as error:return {'code':code,'status':'FAIL','error':type(error).__name__}
    with ThreadPoolExecutor(max_workers=2) as pool:checks=list(pool.map(check,sample))
    # Repeat Bangkok with a separate request: compare numerical values, not request-time headers.
    repeated=parse_csv(fetch_csv(points['TH']),points['TH'])
    checksum=hashlib.sha256(json.dumps([p['value'] for p in repeated['series']]).encode()).hexdigest()
    stable=checks[0].get('seriesSha256')==checksum
    passed=all(c['status']=='PASS' and c.get('trendCoverageGate') and c.get('rejected')==0 for c in checks if c['code']!='MV') and stable
    report={'checkedAt':datetime.now(timezone.utc).isoformat(),'status':'PASS' if passed else 'FAIL','product':'GLDAS_NOAH025_M.2.1','parameter':'SoilMoi0_10cm_inst',
      'period':{'start':2001,'end':2024},'unit':'kg/m²','depthCm':[0,10],'bangkokRepeatValuesMatch':stable,'checks':checks,
      'scope':'Access, metadata, grid, temporal completeness and conservative range validation. Not ground-truth accuracy validation; no per-observation QA flags supplied.',
      'spatialRule':'Containing 0.25-degree model cell, never a neighbouring fallback. Maldives is an island/missing-data diagnostic, not an integration gate.',
      'sources':['https://ldas.gsfc.nasa.gov/gldas/dataset','https://hydro1.gesdisc.eosdis.nasa.gov/data/GLDAS/GLDAS_NOAH025_M.2.1/doc/README_GLDAS2.pdf']}
    (ROOT/'docs/gldas-soil-validation.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2,ensure_ascii=False));return 0 if passed else 1


if __name__=='__main__':raise SystemExit(main())
