"""Publish one consistent DB snapshot as immutable files, switching the manifest last."""
import hashlib
import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from .observations import ROOT, MONTHS, NORMALIZATION_VERSION, catalog
from .source_settings import ENABLED_SOURCES

CACHE=ROOT/'web/public/explorer-cache'
STAGING=ROOT/'pipeline/raw/cache-staging'


def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,sort_keys=True,allow_nan=False,separators=(',',':')),encoding='utf-8')


def capture(conn):
    locations={c['id']:c for c in catalog()}
    capitals={}
    with conn.transaction(),conn.cursor(row_factory=dict_row) as cur:
        cur.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
        batches={b['id']:b for b in cur.execute("""SELECT b.*,p.source,p.name,p.version,p.source_url FROM earth.ingestion_batches b
          JOIN earth.products p ON p.id=b.product_id""").fetchall()}
        rows=cur.execute("""WITH picks AS (
          SELECT DISTINCT ON(o.location_id,o.variable) o.batch_id,o.location_id,o.variable
          FROM earth.observations o JOIN earth.ingestion_batches b ON b.id=o.batch_id JOIN earth.products p ON p.id=o.product_id
          WHERE b.normalization_version=%s AND p.source=ANY(%s) AND ((p.source='power' AND b.qa_policy='power-screen-v1')
             OR (p.source='modis' AND b.qa_policy='good-land-clear-v1')
             OR (p.source='gldas' AND b.qa_policy='gldas-soil-screen-v1')
             OR (p.source='giovanni' AND b.qa_policy='giovanni-monthly-screen-v1'))
          ORDER BY o.location_id,o.variable,b.retrieved_at DESC,b.imported_at DESC,b.id DESC)
          SELECT o.* FROM earth.observations o JOIN picks k ON k.batch_id=o.batch_id AND k.location_id=o.location_id AND k.variable=o.variable
          ORDER BY o.location_id,o.variable,o.month""",(NORMALIZATION_VERSION,list(ENABLED_SOURCES))).fetchall()
    for row in rows:
        loc=locations.get(row['location_id'])
        if not loc: continue  # Old coordinate revisions never masquerade as the current capital point.
        code=loc['code']; b=batches[row['batch_id']]
        capital=capitals.setdefault(code,{'requested':{'lat':loc['lat'],'lon':loc['lon']},'variables':{}})
        if row['variable'] not in capital['variables']:
            coords=b['metadata'].get('response_coordinates',[loc['lon'],loc['lat']])
            capital['variables'][row['variable']]={'unit':row['unit'],'values':[],'missing':[],'rejected':[],
              'source':b['source'],'product':b['name'],'productVersion':b['version'],'batchId':b['id'],
              'qaPolicy':b['qa_policy'],'normalizationVersion':b['normalization_version'],
              'retrievedAt':b['retrieved_at'].isoformat(),'artifactSha256':b['artifact_sha256'],
              'responseCoordinates':{'lon':coords[0],'lat':coords[1]},'sourceUrl':b['metadata'].get('request_url',b['source_url']),
              'sources':b['metadata'].get('sources',[b['name'],b['version'],b['qa_policy']])}
            if 'sourceCoverage' in b['metadata']:
                capital['variables'][row['variable']]['sourceCoverage']=b['metadata']['sourceCoverage']
                capital['variables'][row['variable']]['sourceRows']=b['metadata']['sourceRows']
        item=capital['variables'][row['variable']]
        if row['month'].strftime('%Y-%m')!=MONTHS[len(item['values'])]: raise ValueError('Invalid database calendar grid')
        item['values'].append(row['value'])
        if row['quality']!='valid': item[row['quality']].append(row['month'].strftime('%Y-%m'))
    if not capitals: raise ValueError('No validated observations are available for publication')
    if any(len(v['values'])!=288 for c in capitals.values() for v in c['variables'].values()): raise ValueError('Incomplete database calendar grid')
    return {'schemaVersion':1,'period':{'start':2001,'end':2024},'capitals':capitals}


def derive(input_file,stage):
    subprocess.run(['node','scripts/build-cache-summaries.mjs',str(input_file),str(stage)],cwd=ROOT/'web',check=True)


def publish(conn,root=None,summarizer=None):
    if not conn.autocommit: raise ValueError('Publisher requires an autocommit connection')
    root=Path(root or CACHE).resolve(); root.mkdir(parents=True,exist_ok=True)
    STAGING.mkdir(parents=True,exist_ok=True)
    # Serialize publishers while allowing NASA workers to keep committing observations.
    conn.execute("SELECT pg_advisory_lock(hashtext('earth-cache-publication-v1'))")
    stage=STAGING/uuid4().hex
    try:
        payload=capture(conn)
        logic=b''.join((ROOT/p).read_bytes() for p in ['web/src/core/stats/globalTrend.ts','web/src/features/global/data.ts','web/src/features/global/mapData.ts','web/scripts/build-cache-summaries.mjs','contracts/observation-profiles.json','web/src/features/global/sourceSettings.json','web/public/geo/capitals.json'])
        digest=hashlib.sha256(json.dumps(payload,sort_keys=True,ensure_ascii=False,allow_nan=False).encode()+logic).hexdigest()
        payload['releaseId']=digest
        current=root/'manifest.json'
        if current.exists():
            previous=json.loads(current.read_text(encoding='utf-8'))
            if previous.get('releaseId')==digest:
                refs=list(previous['capitals'].values())
                for group in previous['maps'].values(): refs.extend(group['annual'].values());refs.extend(group['trend'].values())
                if all((root/r['path']).is_file() and hashlib.sha256((root/r['path']).read_bytes()).hexdigest()==r['sha256'] for r in refs):
                    return {'releaseId':digest,'status':'unchanged','capitals':len(payload['capitals'])}
        stage.mkdir()
        source_file=STAGING/(digest+'.input.json');write(source_file,payload)
        for code,record in payload['capitals'].items():
            write(stage/'capitals'/f'{code}.json',{'schemaVersion':1,'releaseId':digest,'code':code,**record})
        (summarizer or derive)(source_file,stage)
        index=json.loads((stage/'map-index.json').read_text(encoding='utf-8'))
        if index['method']!='seasonal-sen-cbb-v1' or index['replicates']!=999 or index['seed']!=271828:
            raise ValueError('Published statistical method is not the validated production method')
        def ref(file):
            file=Path(file)
            data=(stage/file).read_bytes()
            parsed=json.loads(data)
            if parsed.get('releaseId')!=digest: raise ValueError('Mixed cache release')
            return {'path':f'releases/{digest}/{file.as_posix()}','sha256':hashlib.sha256(data).hexdigest()}
        maps={key:{'annual':{year:ref(file) for year,file in group['annual'].items()},'trend':{basis:ref(file) for basis,file in group['trend'].items()}} for key,group in index['maps'].items()}
        manifest={'schemaVersion':1,'releaseId':digest,'publishedAt':datetime.now(timezone.utc).isoformat(),
          'period':payload['period'],'method':index['method'],'replicates':index['replicates'],'seed':index['seed'],
          'capitals':{code:ref(Path('capitals')/f'{code}.json') for code in payload['capitals']},'maps':maps,
          'available':{key:sorted(code for code,c in payload['capitals'].items() if key in c['variables']) for key in maps}}
        target=root/'releases'/digest;target.parent.mkdir(parents=True,exist_ok=True)
        if target.exists():
            for file in stage.rglob('*.json'):
                previous=target/file.relative_to(stage)
                if not previous.is_file() or previous.read_bytes()!=file.read_bytes(): raise ValueError('Immutable release content changed')
        else: os.replace(stage,target)
        conn.execute("INSERT INTO earth.cache_releases(id,status,manifest) VALUES (%s,'prepared',%s) ON CONFLICT(id) DO NOTHING",(digest,Jsonb(manifest)))
        temporary=root/f'manifest-{uuid4().hex}.tmp';write(temporary,manifest)
        os.replace(temporary,root/'manifest.json')  # Atomic final switch; failed preparation leaves last-good data available.
        conn.execute("UPDATE earth.cache_releases SET status='published',manifest=%s,published_at=clock_timestamp() WHERE id=%s",(Jsonb(manifest),digest))
        return {'releaseId':digest,'capitals':len(payload['capitals']),'available':{k:len(v) for k,v in manifest['available'].items()},'manifest':str(root/'manifest.json')}
    finally:
        conn.execute("SELECT pg_advisory_unlock(hashtext('earth-cache-publication-v1'))")
        # Only remove this publisher's checked staging directory; never touch existing releases.
        if stage.exists():
            if stage.resolve().parent!=STAGING.resolve() or len(stage.name)!=32: raise RuntimeError('Unsafe staging cleanup path')
            shutil.rmtree(stage)
