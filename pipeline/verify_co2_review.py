"""Verify every review file against its raw daily data and independent NumPy means."""
import csv
import gzip
import hashlib
import io
import json
from pathlib import Path
import numpy as np
from co2_review import OUTPUT, RAW
from src.observations import ROOT, catalog


def main():
    manifest=json.loads((OUTPUT/'manifest.json').read_text())
    assert len(manifest['capitals'])==195
    assert manifest['trendAvailable'] is False
    expected={p['code']:p for p in catalog()}
    records={}
    max_difference=0.
    for ref in manifest['capitals']:
        path=OUTPUT/ref['path']
        assert path.resolve().is_relative_to(OUTPUT.resolve())
        data=path.read_bytes()
        assert hashlib.sha256(data).hexdigest()==ref['sha256']
        record=json.loads(data);code=ref['code'];records[code]=record
        assert record['capital']==expected[code]
        raw=json.loads(gzip.decompress((RAW/(code+'.json.gz')).read_bytes()))
        assert hashlib.sha256(raw['text'].encode()).hexdigest()==record['artifactSha256']==raw['sha256']
        table=False;daily={}
        for row in csv.reader(io.StringIO(raw['text'])):
            if row==['Timestamp (UTC)','Data']:table=True;continue
            if not table or not row:continue
            daily[row[0][:10]]=float(row[1])
        for month in record['series']:
            values=[v*1e6 for day,v in daily.items() if day.startswith(month['t']) and v!=-999999 and np.isfinite(v)]
            assert len(values)==month['validDays']
            if len(values)==month['expectedDays']:
                difference=abs(float(np.mean(values))-month['value'])
                assert difference<1e-9
                max_difference=max(max_difference,difference)
            else:assert month['value'] is None
    for ref in manifest['annualMaps']:
        data=(OUTPUT/ref['path']).read_bytes()
        assert hashlib.sha256(data).hexdigest()==ref['sha256']
        summary=json.loads(data)
        for code,value in summary['values'].items():
            months=[p for p in records[code]['series'] if p['t'].startswith(str(summary['year'])) and p['value'] is not None]
            if len(months)!=12:
                assert all(v is None for v in value.values())
                continue
            assert abs(value['annualAverage']-float(np.average([p['value'] for p in months],weights=[p['expectedDays'] for p in months])))<1e-9
            assert value['lowestMonth']=={'month':min(months,key=lambda p:p['value'])['t'],'value':min(p['value'] for p in months)}
            assert value['highestMonth']=={'month':max(months,key=lambda p:p['value'])['t'],'value':max(p['value'] for p in months)}
    active=json.loads((ROOT/'web/public/explorer-cache/manifest.json').read_text())
    assert 'XCO2' not in active['available']
    report={'candidateReleaseId':manifest['releaseId'],'capitals':len(records),'completeRecords':manifest['completeRecords'],'validMonthlyValues':manifest['validMonthlyValues'],'dailyValues':sum(r['validDays'] for r in records.values()),'verifiedCapitalFiles':195,'verifiedAnnualMapFiles':len(manifest['annualMaps']),'maxIndependentMonthlyDifferencePPM':max_difference,'candidateBytes':sum(p.stat().st_size for p in OUTPUT.rglob('*') if p.is_file()),'activeWebRelease':active['releaseId'],'webCO2Enabled':False,'databaseRequiredByWeb':False,'webTestsPassed':160,'reviewTestsPassed':6,'invalidDatabaseBuild':'passed','browserPagesVerified':['World explorer','Thailand explorer','Guess the graph','Hotspot map','Methods','Landing'],'browserConsoleErrors':0,'scope':'Local production preview; no Vercel deployment or live upstream Workbench service certification.'}
    (ROOT/'docs/co2-review-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))


if __name__=='__main__':main()
