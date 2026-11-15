"""Publish the approved CO2 review as independent static web assets; no database needed."""
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from co2_review import OUTPUT, atomic, encoded
from src.observations import ROOT, catalog


def main():
    manifest=json.loads((OUTPUT/'manifest.json').read_text())
    assert manifest['product']=='OCO2_GEOS_L3CO2_DAY.10r' and manifest['trendAvailable'] is False
    assert {r['code'] for r in manifest['capitals']}=={c['code'] for c in catalog()}
    target=ROOT/'web/public/co2-cache'
    manifest['annualMaps']=[r for r in manifest['annualMaps'] if 2015<=r['year']<=2021]
    assert [r['year'] for r in manifest['annualMaps']]==list(range(2015,2022))
    for ref in manifest['capitals']+manifest['annualMaps']:
        source=OUTPUT/ref['path']
        assert source.resolve().is_relative_to(OUTPUT.resolve())
        data=source.read_bytes()
        assert hashlib.sha256(data).hexdigest()==ref['sha256']
        atomic(target/ref['path'],data)
    reference=ROOT/'pipeline/raw/co2-descriptive-trend-ref.json'
    reference.parent.mkdir(parents=True,exist_ok=True)
    subprocess.run(['node','scripts/build-co2-trends.mjs',manifest['releaseId'],str(reference)],cwd=ROOT/'web',check=True)
    manifest['descriptiveTrend']=json.loads(reference.read_text(encoding='utf-8'))
    manifest['descriptiveTrendAvailable']=True
    manifest.update({'schemaVersion':1,'status':'published','publishedAt':datetime.now(timezone.utc).isoformat()})
    atomic(target/'manifest.json',encoded(manifest))
    print(json.dumps({'releaseId':manifest['releaseId'],'capitals':195,'annualYears':[2015,2021],'trendAvailable':False}))


if __name__=='__main__':main()
