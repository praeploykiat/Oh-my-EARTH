"""Real database leases with mocked NASA IO; no remote jobs are submitted by tests."""
import hashlib
import json
import os
from pathlib import Path
import pytest
from test_database import db
from test_observations import power_envelope, power_doc

pytestmark=pytest.mark.skipif(os.environ.get('RUN_DATABASE_TESTS')!='1',reason='Requires disposable PostgreSQL database')


def pending(db):
    from src.database import seed_locations
    from src.jobs import enqueue
    seed_locations(db)
    return enqueue(db,'power',{'country':'TH','generation':'fixture','period':[2001,2024]},reuse_existing=False)


def test_duplicate_enqueue_and_exclusive_claim(db):
    from src import jobs
    a=pending(db); b=pending(db)
    assert a['id']==b['id']
    claimed=jobs.claim(db)
    assert claimed['id']==a['id'] and jobs.claim(db) is None


def test_current_release_does_not_claim_preserved_ndvi_jobs(db):
    from src import jobs
    from src.source_settings import ENABLED_SOURCES
    jobs.enqueue(db,'modis',{'countries':['TH']})
    assert jobs.claim(db,allowed_sources=list(ENABLED_SOURCES)) is None
    assert db.execute('SELECT status FROM earth.ingestion_jobs').fetchone()[0]=='pending'


def test_gldas_saved_artifact_resumes_without_nasa(db,tmp_path,monkeypatch):
    from src import jobs,ingestion
    from src.database import seed_locations
    from test_gldas import csv_text
    seed_locations(db)
    path=tmp_path/'TH.json'
    path.write_text(json.dumps({'requested':{'code':'TH','lat':13.75,'lon':100.52},'retrievedAt':'2026-11-15T00:00:00Z','csv':csv_text()}))
    jobs.enqueue(db,'gldas',{'country':'TH','generation':'fixture'})
    job=jobs.claim(db)
    jobs.checkpoint(db,job,{'artifact':{'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}})
    jobs.fail(db,job,'interrupted')
    db.execute("UPDATE earth.ingestion_jobs SET available_at=clock_timestamp()-interval '1 second'")
    monkeypatch.setattr(ingestion.requests,'get',lambda *args,**kwargs:pytest.fail('Unexpected NASA request'))
    assert ingestion.run_one(db,'gldas')['status']=='succeeded'
    assert db.execute("SELECT count(*) FROM earth.observations WHERE variable='SOIL_MOISTURE'").fetchone()[0]==288


def test_expired_lease_is_recovered_and_stale_worker_cannot_commit(db,power_doc):
    from src import jobs
    pending(db);old=jobs.claim(db)
    db.execute("UPDATE earth.ingestion_jobs SET lease_until=clock_timestamp()-interval '1 second'")
    current=jobs.claim(db)
    assert current['lease_token']!=old['lease_token']
    with pytest.raises(jobs.LeaseLost):jobs.finish(db,old,power_doc)
    assert jobs.finish(db,current,power_doc)['inserted']==1152
    assert db.execute('SELECT count(*) FROM earth.observations').fetchone()[0]==1152


def test_backoff_and_retry_limits(db):
    from src import jobs
    pending(db);job=jobs.claim(db);jobs.fail(db,job,'HTTP 503')
    assert jobs.claim(db) is None
    db.execute("UPDATE earth.ingestion_jobs SET available_at=clock_timestamp()-interval '1 second'")
    job=jobs.claim(db);jobs.fail(db,job,'Invalid schema',permanent=True)
    db.execute("UPDATE earth.ingestion_jobs SET available_at=clock_timestamp()-interval '1 second'")
    assert jobs.claim(db) is None


def test_power_resumes_saved_artifact_without_refetch(db,power_doc,monkeypatch):
    from src import jobs,ingestion
    pending(db);job=jobs.claim(db)
    artifact=power_doc['artifact']
    jobs.checkpoint(db,job,{'artifact':artifact})
    jobs.fail(db,job,'interrupted')
    db.execute("UPDATE earth.ingestion_jobs SET available_at=clock_timestamp()-interval '1 second'")
    monkeypatch.setattr(ingestion.requests,'get',lambda *a,**k:pytest.fail('Unexpected NASA request'))
    assert ingestion.run_one(db)['status']=='succeeded'
    assert db.execute('SELECT count(*) FROM earth.observations').fetchone()[0]==1152


def layers():
    from src.ndvi import LAYERS
    out={key:{'Available':True} for key in LAYERS}
    out[LAYERS[0]].update(Units='',ScaleFactor=0.0001,ValidMin=-0.2,ValidMax=1,DataType='float32')
    return out


def test_existing_ndvi_task_is_polled_not_submitted_and_waits_are_not_failures(db,monkeypatch):
    from src import jobs,ingestion
    task='970961e5-ac1d-4652-9731-a0fc45b8dbd0'
    jobs.enqueue(db,'modis',{'countries':['TH']},task)
    calls=[]
    def fake(path,method='GET',**kwargs):
        calls.append((path,method))
        assert method=='GET'
        return layers() if path.startswith('/product/') else {'status':'processing'}
    monkeypatch.setattr(ingestion,'api',fake)
    assert ingestion.run_one(db)['status']=='waiting'
    row=db.execute('SELECT status,external_task_id,failures,lease_token FROM earth.ingestion_jobs').fetchone()
    assert row[0]=='pending' and str(row[1])==task and row[2]==0 and row[3] is None
    assert any(path==f'/task/{task}' for path,_ in calls)


def test_ambiguous_submission_reconciles_without_duplicate_post(db,monkeypatch):
    from src import jobs,ingestion
    job=jobs.enqueue(db,'modis',{'countries':['TH']})
    db.execute('UPDATE earth.ingestion_jobs SET checkpoint=%s WHERE id=%s',(json.dumps({'submission_intent':True}),job['id']))
    def fake(path,method='GET',**kwargs):
        assert method=='GET'
        return layers() if path.startswith('/product/') else []
    monkeypatch.setattr(ingestion,'api',fake)
    assert ingestion.run_one(db)['status']=='waiting'
    assert db.execute('SELECT checkpoint FROM earth.ingestion_jobs').fetchone()[0]['stage']=='submission_reconciliation'


def test_download_drops_token_on_storage_redirect(monkeypatch,tmp_path):
    from src import ingestion
    calls=[]
    class Reply:
        def __init__(self,status):self.status_code=status;self.headers={'Location':'https://storage.example/data?signature=private'}
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def iter_content(self,*args):yield b'validated csv'
    def get(url,**kwargs):
        calls.append((url,kwargs['headers']))
        return Reply(302 if len(calls)==1 else 200)
    monkeypatch.setattr(ingestion,'token',lambda:'fixture-token')
    monkeypatch.setattr(ingestion.requests,'get',get)
    task='970961e5-ac1d-4652-9731-a0fc45b8dbd0'
    ingestion.download(task,task,tmp_path/'data.csv',lambda:None)
    assert calls[0][1]['Authorization']=='Bearer fixture-token' and calls[1][1]=={}
    assert (tmp_path/'data.csv').read_bytes()==b'validated csv'


def test_completed_ndvi_resumes_download_and_commits_strict_qa(db,monkeypatch,tmp_path):
    import csv
    from src import jobs,ingestion
    from src.database import seed_locations
    from src.ndvi import PRODUCT,LAYERS
    seed_locations(db)
    task='970961e5-ac1d-4652-9731-a0fc45b8dbd0'
    job=jobs.enqueue(db,'modis',{'countries':['TH']},task)
    path=tmp_path/'saved_results.csv'
    with path.open('w',newline='') as stream:
        writer=csv.writer(stream)
        writer.writerow(['ID','Latitude','Longitude','Date']+['MOD13A3_061_'+layer for layer in LAYERS])
        writer.writerow(['TH',13.75,100.52,'2001-01-01',0.3,2048,0])
        writer.writerow(['TH',13.75,100.52,'2001-02-01',0.4,2048,1])
    file_id='3cb29fbb-080a-4f88-b2ed-46c07b5ea360'
    saved={file_id:{'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}}
    db.execute('UPDATE earth.ingestion_jobs SET checkpoint=%s WHERE id=%s',(json.dumps({'files':saved}),job['id']))
    def fake(route,method='GET',**kwargs):
        assert method=='GET'
        if route.startswith('/product/'):return layers()
        if route.startswith('/bundle/'):return {'files':[{'file_id':file_id,'file_name':'results.csv'}]}
        return {'status':'done','params':{'layers':[{'product':PRODUCT,'layer':layer} for layer in LAYERS],
          'dates':[{'startDate':'01-01-2001','endDate':'12-31-2024'}],
          'coordinates':[{'id':'TH','latitude':13.75,'longitude':100.52}]}}
    monkeypatch.setattr(ingestion,'api',fake)
    monkeypatch.setattr(ingestion,'download',lambda *args:pytest.fail('Completed file must not be downloaded again'))
    monkeypatch.setattr(ingestion,'RAW',tmp_path/'raw')
    assert ingestion.run_one(db)['status']=='succeeded'
    quality=dict(db.execute('SELECT quality,count(*) FROM earth.observations GROUP BY quality').fetchall())
    assert quality=={'valid':1,'rejected':1,'missing':286}
    assert db.execute("SELECT value FROM earth.observations WHERE quality='valid'").fetchone()[0]==0.3
