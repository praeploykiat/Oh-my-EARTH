"""Resumable CO2 review ingestion; publishes only to docs/co2-candidate-cache.

No frontend registry, production observation batches or active cache are modified.
Run again to resume; validated local artifacts are reused without NASA requests.
"""
import calendar
import csv
import gzip
import hashlib
import io
import json
import math
from datetime import datetime, timezone
from pathlib import Path

from psycopg.types.json import Jsonb
from src.credentials import earthdata_token
from src.database import connect, migrate
from src.observations import ROOT, catalog
from src.giovanni import cell

PRODUCT = 'OCO2_GEOS_L3CO2_DAY.10r'
API_ID = 'OCO2_GEOS_L3CO2_DAY_10r_XCO2'
RAW = ROOT / 'pipeline/raw/co2-review'
OUTPUT = ROOT / 'docs/co2-candidate-cache'


def encoded(value):
    return (json.dumps(value, sort_keys=True, allow_nan=False, separators=(',', ':'))+'\n').encode()


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix+'.part')
    temporary.write_bytes(data)
    temporary.replace(path)


def normalize(text, point):
    metadata, daily = {}, {}
    table = False
    for row in csv.reader(io.StringIO(text)):
        if not row or not any(row):
            continue
        if row == ['Timestamp (UTC)', 'Data']:
            table = True
            continue
        if not table:
            if len(row)<2 or row[0] in metadata:
                raise ValueError('Malformed metadata')
            metadata[row[0]] = ','.join(row[1:])
            continue
        if len(row)!=2:
            raise ValueError('Malformed data row')
        stamp = datetime.fromisoformat(row[0])
        if stamp.tzinfo or stamp.hour!=12 or stamp.minute or stamp.second or stamp in daily:
            raise ValueError('Unexpected or duplicate timestamp')
        if not datetime(2015,1,1,12)<=stamp<=datetime(2022,2,28,12):
            raise ValueError('Unexpected source coverage; review product before refreshing')
        value = float(row[1])
        if value == -999999:
            daily[stamp] = None
        elif not math.isfinite(value) or not 250<=value*1e6<=600:
            raise ValueError('Invalid CO2 value')
        else:
            daily[stamp] = value*1e6
    for key, expected in {'prod_name':PRODUCT, 'param_short_name':'XCO2', 'doi':'10.5067/Y9M4NM9MPCGH', 'unit':'mol CO2/mol dry', 'begin_time':'2015-01-01 12:00:00', 'end_time':'2022-02-28 12:00:00'}.items():
        if metadata.get(key)!=expected:
            raise ValueError('Incorrect source identity/units/coverage: '+key)
    if float(metadata['undef'])!=-999999:
        raise ValueError('Incorrect fill value')
    coordinates = cell('AOD', point)
    for key, resolution in [('lat',.5),('lon',.625)]:
        if abs(float(metadata[key])-coordinates[key])>1e-6 or float(metadata[key+'_resolution'])!=resolution:
            raise ValueError('Incorrect response grid')
    if not table or not daily:
        raise ValueError('Empty response')
    series=[]
    for year in range(2015,2023):
        for month in range(1,13):
            key=f'{year}-{month:02d}'
            if key>'2022-02':continue
            expected=calendar.monthrange(year,month)[1]
            values=[daily.get(datetime(year,month,day,12)) for day in range(1,expected+1)]
            valid=[v for v in values if v is not None]
            series.append({'t':key,'value':math.fsum(valid)/expected if len(valid)==expected else None,'validDays':len(valid),'expectedDays':expected})
    # No inferred values or interpolation; all expected days are required per month.
    return {'capital':point,'product':PRODUCT,'variable':'XCO2','unit':'ppm','responseCoordinates':coordinates,'metadata':metadata,'dailyRows':len(daily),'validDays':sum(v is not None for v in daily.values()),'series':series}


def main():
    import argparse
    import requests
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--publish-only',action='store_true',help='Publish complete local review records without NASA requests')
    args=parser.parse_args()
    RAW.mkdir(parents=True,exist_ok=True)
    with connect() as conn:
        migrate(conn)
    failed=[]
    for index, point in enumerate([] if args.publish_only else catalog(),1):
        path=RAW/(point['code']+'.json.gz')
        try:
            if path.exists():
                artifact=json.loads(gzip.decompress(path.read_bytes()))
                if artifact['capital']!=point or hashlib.sha256(artifact['text'].encode()).hexdigest()!=artifact['sha256']:
                    raise ValueError('Checkpoint checksum/coordinate mismatch')
            else:
                response=requests.get('https://api.giovanni.earthdata.nasa.gov/timeseries',params={'data':API_ID,'location':f"[{point['lat']:.4f},{point['lon']:.4f}]",'time':'2015-01-01T00:00:00/2022-02-28T23:59:59'},headers={'Authorization':'Bearer '+earthdata_token()},timeout=(10,120),allow_redirects=False)
                if response.status_code!=200:
                    raise ValueError('NASA HTTP '+str(response.status_code))
                artifact={'capital':point,'text':response.text,'sha256':hashlib.sha256(response.text.encode()).hexdigest(),'retrievedAt':datetime.now(timezone.utc).isoformat()}
                normalize(artifact['text'],point)
                atomic(path,gzip.compress(encoded(artifact),mtime=0))
            record=normalize(artifact['text'],point)
            record.update({'artifactSha256':artifact['sha256'],'retrievedAt':artifact['retrievedAt']})
            with connect() as conn:
                conn.execute('INSERT INTO earth.co2_review_records VALUES (%s,%s,%s,%s,%s) ON CONFLICT (capital_code) DO UPDATE SET product=EXCLUDED.product,artifact_sha256=EXCLUDED.artifact_sha256,retrieved_at=EXCLUDED.retrieved_at,payload=EXCLUDED.payload',(point['code'],PRODUCT,artifact['sha256'],artifact['retrievedAt'],Jsonb(record)))
            print(f'{index}/195 {point["code"]} saved',flush=True)
        except Exception as error:
            # Avoid printing exception details from network libraries or credentials.
            failed.append(point['code'])
            print(f'{index}/195 {point["code"]} failed ({type(error).__name__}); rerun to retry',flush=True)
    if failed:
        atomic(RAW/'progress.json',encoded({'failed':failed,'status':'incomplete-not-published'}))
        raise SystemExit('Incomplete ingestion; candidate publication withheld')
    with connect() as conn:
        records=[r[0] for r in conn.execute('SELECT payload FROM earth.co2_review_records ORDER BY capital_code')]
    assert {r['capital']['code'] for r in records}=={p['code'] for p in catalog()}
    release=hashlib.sha256(encoded(records)+Path(__file__).read_bytes()).hexdigest()
    refs=[]
    for record in records:
        data=encoded(record);path=Path('releases')/release/'capitals'/(record['capital']['code']+'.json')
        atomic(OUTPUT/path,data)
        refs.append({'code':record['capital']['code'],'path':path.as_posix(),'sha256':hashlib.sha256(data).hexdigest()})
    maps=[]
    for year in range(2015,2023):
        values={}
        for record in records:
            months=[p for p in record['series'] if p['t'].startswith(str(year))]
            valid=[p for p in months if p['value'] is not None]
            complete=len(valid)==12
            low=min(valid,key=lambda p:p['value']) if complete else None
            high=max(valid,key=lambda p:p['value']) if complete else None
            values[record['capital']['code']]={'annualAverage':math.fsum(p['value']*p['expectedDays'] for p in valid)/sum(p['expectedDays'] for p in valid) if complete else None,'lowestMonth':{'month':low['t'],'value':low['value']} if low else None,'highestMonth':{'month':high['t'],'value':high['value']} if high else None}
        data=encoded({'year':year,'unit':'ppm','values':values,'method':'Day-weighted annual mean; extrema of complete monthly means. All 12 months required.'})
        path=Path('releases')/release/'maps'/f'annual-{year}.json'
        atomic(OUTPUT/path,data)
        maps.append({'year':year,'path':path.as_posix(),'sha256':hashlib.sha256(data).hexdigest()})
    manifest={'status':'candidate-awaiting-user-verification','releaseId':release,'product':PRODUCT,'variable':'XCO2','unit':'ppm','period':{'start':'2015-01','end':'2022-02'},'completeCalendarYears':[2015,2021],'capitals':refs,'annualMaps':maps,'trendAvailable':False,'trendReason':'Only seven complete years; existing engine requires at least ten.','completeRecords':sum(all(p['value'] is not None for p in r['series']) for r in records),'validMonthlyValues':sum(p['value'] is not None for r in records for p in r['series']),'scope':'Review files only. Not part of web/public or the production publisher. No trend claims.'}
    atomic(OUTPUT/'manifest.json',encoded(manifest))
    print(json.dumps({k:v for k,v in manifest.items() if k!='capitals'}),flush=True)


if __name__=='__main__':
    main()
