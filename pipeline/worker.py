"""Resumable ingestion worker. Never started by browser requests."""
import argparse
import json
import time
from uuid import UUID
from concurrent.futures import ThreadPoolExecutor
from src.database import connect, migrate, seed_locations
from src.observations import catalog
from src.jobs import enqueue
from src.ingestion import run_one
from src.source_settings import ENABLED_SOURCES


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='command',required=True)
    for name in ['enqueue-power','enqueue-ndvi','enqueue-gldas','enqueue-giovanni']:
        p=sub.add_parser(name);p.add_argument('--countries',default='all');p.add_argument('--generation',default='initial')
        if name=='enqueue-ndvi':p.add_argument('--task-id')
        if name=='enqueue-giovanni':p.add_argument('--variable',choices=['AOD','EVAPOTRANSPIRATION'],required=True)
    p=sub.add_parser('run');p.add_argument('--source',choices=['power','modis','gldas','giovanni']);p.add_argument('--max-jobs',type=int,default=1);p.add_argument('--workers',type=int,choices=[1,2],default=1);p.add_argument('--watch',action='store_true');p.add_argument('--publish',action='store_true')
    p=sub.add_parser('retry');p.add_argument('--id',type=int,required=True)
    p=sub.add_parser('adopt');p.add_argument('--id',type=int,required=True);p.add_argument('--task-id',required=True)
    sub.add_parser('status')
    args=parser.parse_args()
    if args.command=='enqueue-ndvi' or args.command=='adopt' or args.command=='run' and args.source=='modis':
        if 'modis' not in ENABLED_SOURCES:parser.error('AppEEARS/NDVI is disabled in web/src/features/global/sourceSettings.json; saved jobs and data are preserved.')
    if args.command=='enqueue-gldas' or args.command=='run' and args.source=='gldas':
        if 'gldas' not in ENABLED_SOURCES:parser.error('GLDAS is not enabled in the source policy')
    with connect() as conn:
        conn.autocommit=True; migrate(conn); seed_locations(conn)
        if args.command.startswith('enqueue'):
            codes=sorted(c['code'] for c in catalog()) if args.countries=='all' else sorted(set(args.countries.split(',')))
            if not set(codes).issubset({c['code'] for c in catalog()}): raise ValueError('Unknown capital code')
            if args.command in ('enqueue-power','enqueue-gldas'):
                source='gldas' if args.command=='enqueue-gldas' else 'power'
                out=[enqueue(conn,source,{'country':c,'generation':args.generation,'period':[2001,2024]},reuse_existing=args.generation=='initial') for c in codes]
            elif args.command=='enqueue-giovanni':
                out=[enqueue(conn,'giovanni',{'country':c,'variable':args.variable,'generation':args.generation,'period':[2001,2024]},reuse_existing=False) for c in codes]
            else:
                task=str(UUID(args.task_id)) if args.task_id else None
                out=[enqueue(conn,'modis',{'countries':codes,'generation':args.generation,'period':[2001,2024],'product':'MOD13A3.061'},task)]
            print(json.dumps({'jobs':len(out),'succeeded':sum(j['status']=='succeeded' for j in out),'ids':[j['id'] for j in out]}));return
        if args.command in ('retry','adopt'):
            with conn.transaction():
                row=conn.execute("SELECT source,external_task_id,status FROM earth.ingestion_jobs WHERE id=%s FOR UPDATE",(args.id,)).fetchone()
                if not row or row[2]=='running':raise ValueError('Unknown job or active worker lease')
                if args.command=='adopt':
                    task=str(UUID(args.task_id))
                    if row[0]!='modis' or row[1] and str(row[1])!=task:raise ValueError('Cannot replace an existing source task')
                    conn.execute("UPDATE earth.ingestion_jobs SET external_task_id=%s WHERE id=%s",(task,args.id))
                conn.execute("UPDATE earth.ingestion_jobs SET status='pending',failures=0,last_error=NULL,available_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=%s",(args.id,))
            print(json.dumps({'id':args.id,'status':'pending'}));return
        if args.command=='status':
            print(json.dumps([{'source':r[0],'status':r[1],'count':r[2]} for r in conn.execute('SELECT source,status,count(*) FROM earth.ingestion_jobs GROUP BY source,status ORDER BY source,status').fetchall()]));return
    if args.max_jobs<1: raise ValueError('--max-jobs must be positive')
    def consume(pair):
        index,limit=pair
        completed=0;last_publish=0
        with connect() as conn:
            conn.autocommit=True
            while args.watch or completed<limit:
                result=run_one(conn,args.source,allowed_sources=list(ENABLED_SOURCES))
                if args.watch and args.publish and index==0 and time.monotonic()-last_publish>60:
                    from src.publication import publish
                    try:print(json.dumps(publish(conn)),flush=True)
                    except Exception as error:print(json.dumps({'publication':'failed','error':type(error).__name__}),flush=True)
                    last_publish=time.monotonic()
                if result is None:
                    if not args.watch:break
                    time.sleep(5);continue
                completed+=1
                print(json.dumps(result),flush=True)
        return completed
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        counts=list(pool.map(consume,[(i,args.max_jobs//args.workers+(i<args.max_jobs%args.workers)) for i in range(args.workers)]))
    if args.publish:
        from src.publication import publish
        with connect() as conn:
            conn.autocommit=True;print(json.dumps(publish(conn)))
    print(json.dumps({'processed':sum(counts)}))


if __name__=='__main__':
    try:main()
    except Exception as error:
        print(f'Worker command failed ({type(error).__name__}); check database setup or job status.');raise SystemExit(1) from None
