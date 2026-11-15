"""Reproduce the AOD/ET capital pilot; private token, no DB writes or publication."""
import argparse
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
from pathlib import Path
from src.observations import ROOT,catalog
from src.giovanni import SPECS,fetch,observation_batch


def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--resume',action='store_true');args=parser.parse_args()
 directory=ROOT/'pipeline/raw/giovanni-expansion';directory.mkdir(parents=True,exist_ok=True)
 points={c['code']:c for c in catalog()};countries=['TH','EG','NO','AU','BR','CA','KE','MV']
 def check(pair):
  variable,code=pair;path=directory/f'{variable}-{code}.json'
  try:
   if not args.resume or not path.exists():
    csv=fetch(variable,points[code]);path.write_text(json.dumps({'variable':variable,'requested':points[code],'retrievedAt':datetime.now(timezone.utc).isoformat(),'csv':csv}),encoding='utf-8')
   d=observation_batch(path);values=[r['value'] for r in d['observations'] if r['value'] is not None]
   return {'variable':variable,'code':code,'capital':points[code]['city'],'valid':len(values),'missing':sum(r['quality']=='missing' for r in d['observations']),'rejected':sum(r['quality']=='rejected' for r in d['observations']),
    'minimum':min(values) if values else None,'maximum':max(values) if values else None,'unit':d['observations'][0]['unit'],
    'sourceRows':d['metadata']['sourceRows'],'responseCoordinates':d['metadata']['response_coordinates'],'artifactSha256':d['artifact']['sha256'],'retrievedAt':d['retrieved_at']}
  except Exception as error:return {'variable':variable,'code':code,'error':type(error).__name__}
 with ThreadPoolExecutor(max_workers=2) as pool:checks=list(pool.map(check,[(v,c) for v in SPECS for c in countries]))
 passed=all('error' not in r and r['rejected']==0 and (r['valid']==288 or r['variable']=='EVAPOTRANSPIRATION' and r['code']=='MV') for r in checks)
 report={'checkedAt':datetime.now(timezone.utc).isoformat(),'status':'PASS' if passed else 'FAIL','period':[2001,2024],'checks':checks,
  'AODRule':'All calendar hours must be valid for a monthly mean; positive 1e15 fill, absent and invalid hours produce a monthly gap.',
  'scope':'Access, metadata, grid and numerical screening, not ground-truth accuracy. ET signed fluxes are retained. Maldives is an ET land-mask diagnostic.'}
 (ROOT/'pipeline/raw/giovanni-expansion/pilot-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(report,indent=2));return 0 if passed else 1


if __name__=='__main__':raise SystemExit(main())
