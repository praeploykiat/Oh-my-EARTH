"""NASA IO only in background workers; credentials never go to the browser."""
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from urllib.parse import urljoin, urlsplit
from uuid import UUID
import requests
from . import jobs
from .observations import ROOT, PROFILES, catalog, power_batch, ndvi_batch
from .ndvi import PRODUCT, LAYERS, QA_POLICY, validate_layers, read_point_csv

APPEEARS="https://appeears.earthdatacloud.nasa.gov/api"
RAW=ROOT / "pipeline/raw/ingestion"


class SourceError(RuntimeError):
    def __init__(self,status):
        self.status=status
        super().__init__(f"Source HTTP {status}")


def write_json(path,data):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix(path.suffix+".part")
    tmp.write_text(json.dumps(data,ensure_ascii=False,sort_keys=True,allow_nan=False),encoding="utf-8")
    os.replace(tmp,path)


def token():
    value=os.environ.get("APPEEARS_TOKEN")
    if not value:
        # Existing workspace token is a development fallback; deployment uses the environment.
        for path in [ROOT / "pipeline/.env", ROOT.parent / "nasa_source_tests/.env"]:
            if path.exists():
                for line in path.read_text(encoding="utf-8-sig").splitlines():
                    key,sep,raw=line.strip().partition("=")
                    if sep and key=="APPEEARS_TOKEN": value=raw.strip().strip("\"'")
            if value: break
    if not value or "\n" in value or "\r" in value: raise SourceError(401)
    return value


def api(path,method="GET",payload=None,authenticated=True):
    if not path.startswith("/") or "://" in path: raise ValueError("Invalid AppEEARS path")
    response=requests.request(method,APPEEARS+path,json=payload,
      headers={"Authorization":f"Bearer {token()}"} if authenticated else {},timeout=(10,60),allow_redirects=False)
    if not 200 <= response.status_code < 300: raise SourceError(response.status_code)
    return response.json()


def download(task,file_id,path,heartbeat):
    url=f"{APPEEARS}/bundle/{UUID(str(task))}/{UUID(str(file_id))}"
    headers={"Authorization":f"Bearer {token()}"}
    for _ in range(6):
        with requests.get(url,headers=headers,timeout=(10,60),allow_redirects=False,stream=True) as response:
            if response.status_code in (301,302,303,307,308):
                url=urljoin(url,response.headers['Location'])
                if urlsplit(url).scheme != "https": raise ValueError("Unsafe download redirect")
                headers={}  # Never forward NASA authentication to redirected object storage.
                continue
            if response.status_code != 200: raise SourceError(response.status_code)
            partial=path.with_suffix(path.suffix+".part")
            last=time.monotonic()
            with partial.open('wb') as stream:
                for chunk in response.iter_content(1024*1024):
                    stream.write(chunk)
                    if time.monotonic()-last>15: heartbeat(); last=time.monotonic()
            os.replace(partial,path)
            return
    raise ValueError("Too many download redirects")


def artifact_ok(item):
    if not item: return False
    path=Path(item['path'])
    return path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest()==item['sha256']


def ingest_power(conn,job):
    cached=job['checkpoint'].get('artifact')
    if artifact_ok(cached): return power_batch(cached['path'])
    point=next(c for c in catalog() if c['code']==job['spec']['country'])
    response=requests.get("https://power.larc.nasa.gov/api/temporal/monthly/point",params={
      'parameters':','.join(PROFILES['power']['variables']),'community':'RE','latitude':f"{point['lat']:.4f}",
      'longitude':f"{point['lon']:.4f}",'start':2001,'end':2024,'format':'JSON'},timeout=(10,60))
    if response.status_code!=200: raise SourceError(response.status_code)
    envelope={'requested':point,'retrievedAt':datetime.now(timezone.utc).isoformat(),'raw':response.json()}
    path=RAW / 'power' / f"{job['work_key']}-{job['lease_token']}.json"
    write_json(path,envelope)
    doc=power_batch(path)
    jobs.checkpoint(conn,job,{'artifact':{'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}})
    return doc


def ingest_ndvi(conn,job):
    cached=job['checkpoint'].get('artifact')
    if artifact_ok(cached): return ndvi_batch(cached['path'])
    expected={c['code']:c for c in catalog() if c['code'] in job['spec']['countries']}
    if not expected or len(expected)!=len(job['spec']['countries']): raise ValueError('Invalid NDVI coordinates')
    metadata=api(f'/product/{PRODUCT}',authenticated=False)
    validate_layers(metadata)
    if not job['external_task_id']:
        name='earth-ndvi-'+job['work_key'][:20]
        matches=[t for t in api('/task') if t.get('task_name')==name]
        if len(matches)>1: raise ValueError('Ambiguous AppEEARS submission; operator review required')
        if matches:
            jobs.checkpoint(conn,job,external_task_id=str(UUID(matches[0]['task_id'])))
        elif job['checkpoint'].get('submission_intent'):
            # A previous POST may have succeeded before a process crash/timeout. Reconcile, never blindly resubmit.
            jobs.checkpoint(conn,job,{'stage':'submission_reconciliation'})
            return None
        else:
            request={'task_type':'point','task_name':name,'params':{
              'dates':[{'startDate':'01-01-2001','endDate':'12-31-2024'}],
              'layers':[{'product':PRODUCT,'layer':layer} for layer in LAYERS],
              'coordinates':[{'id':c['code'],'latitude':c['lat'],'longitude':c['lon']} for c in expected.values()]}}
            jobs.checkpoint(conn,job,{'submission_intent':True})
            result=api('/task',method='POST',payload=request)
            jobs.checkpoint(conn,job,external_task_id=str(UUID(result['task_id'])))
    task_id=str(job['external_task_id'])
    task=api(f'/task/{task_id}')
    if task.get('status')=='error': raise ValueError('AppEEARS extraction failed')
    if task.get('status')!='done':
        jobs.checkpoint(conn,job,{'stage':task.get('status','processing')})
        return None
    params=task['params']
    if {x['product'] for x in params['layers']}!={PRODUCT} or not set(LAYERS).issubset({x['layer'] for x in params['layers']}):
        raise ValueError('Unexpected extraction product or QA layers')
    if params['dates']!=[{'startDate':'01-01-2001','endDate':'12-31-2024'}]: raise ValueError('Unexpected extraction period')
    points={}
    for point in params['coordinates']:
        code='TH' if point['id']=='sample-point' else point['id']
        loc=expected.get(code)
        if not loc or abs(point['latitude']-loc['lat'])>0.0001 or abs(point['longitude']-loc['lon'])>0.0001:
            raise ValueError('Extraction points differ from requested capitals')
        points[point['id']]=loc
    if len(points)!=len(expected): raise ValueError('Incomplete extraction point list')
    directory=RAW / 'ndvi' / task_id; directory.mkdir(parents=True,exist_ok=True)
    saved=job['checkpoint'].get('files',{})
    bundle=api(f'/bundle/{task_id}')
    for entry in bundle.get('files',[]):
        file_id=str(UUID(entry['file_id']))
        if artifact_ok(saved.get(file_id)): continue
        name=PurePosixPath(entry['file_name'].replace('\\','/')).name
        if name in ('','.','..') or any(c in name for c in '<>:"|?*'): raise ValueError('Unsafe bundle filename')
        path=directory / f'{file_id}_{name}'
        download(task_id,file_id,path,lambda:jobs.checkpoint(conn,job))
        saved[file_id]={'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        jobs.checkpoint(conn,job,{'files':saved,'stage':'downloaded'})
    csvs=[Path(item['path']) for item in saved.values() if item['path'].endswith('results.csv')]
    if len(csvs)!=1: raise ValueError('Expected exactly one NDVI CSV')
    records=read_point_csv(csvs[0],points)
    if not sum(r['sourceRows'] for r in records.values()): raise ValueError('Empty NDVI extraction')
    snapshot={'schemaVersion':1,'product':PRODUCT,'variable':'NDVI','unit':'1','period':{'start':2001,'end':2024},
      'retrievedAt':datetime.fromtimestamp(csvs[0].stat().st_mtime,timezone.utc).isoformat(),'qaPolicy':QA_POLICY,'taskId':task_id,
      'records':{points[key]['code']:{'requested':{'lat':points[key]['lat'],'lon':points[key]['lon']},
        'values':[p['value'] for p in record['series']],'missing':record['missing'],'rejected':record['rejected']} for key,record in records.items()}}
    path=directory/'validated.json'; write_json(path,snapshot)
    doc=ndvi_batch(path)
    jobs.checkpoint(conn,job,{'artifact':{'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()},'stage':'validated'})
    return doc


def run_one(conn,source=None,allowed_sources=None):
    job=jobs.claim(conn,source,allowed_sources=allowed_sources)
    if not job: return None
    try:
        doc=ingest_power(conn,job) if job['source']=='power' else ingest_ndvi(conn,job)
        if doc is None:
            jobs.defer(conn,job)
            return {'id':job['id'],'source':job['source'],'status':'waiting'}
        result=jobs.finish(conn,job,doc)
        return {'id':job['id'],'source':job['source'],'status':'succeeded','inserted':result['inserted']}
    except jobs.LeaseLost:
        return {'id':job['id'],'status':'lease_lost'}
    except Exception as error:
        permanent=isinstance(error,(ValueError,KeyError,TypeError)) or isinstance(error,SourceError) and error.status in (400,404)
        message=f'Source HTTP {error.status}' if isinstance(error,SourceError) else type(error).__name__
        try: jobs.fail(conn,job,message,permanent=permanent)
        except jobs.LeaseLost: pass
        return {'id':job['id'],'source':job['source'],'status':'failed','error':message}
