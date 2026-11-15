"""Audit a saved AppEEARS point CSV and its task metadata; never fetch or publish data."""
import argparse
import json
from pathlib import Path
from datetime import datetime, timezone
from src.observations import catalog
from src.ndvi import PRODUCT, LAYERS
from src.ndvi_audit import audit_csv


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv',required=True);parser.add_argument('--task',required=True);parser.add_argument('--output',required=True)
    args=parser.parse_args()
    task=json.loads(Path(args.task).read_text(encoding='utf-8'))
    params=task['params']
    if {x['product'] for x in params['layers']}!={PRODUCT} or not set(LAYERS).issubset({x['layer'] for x in params['layers']}):raise ValueError('Wrong product/layers')
    if params['dates']!=[{'startDate':'01-01-2001','endDate':'12-31-2024'}]:raise ValueError('Wrong period')
    locations={c['code']:c for c in catalog()};points={}
    for p in params['coordinates']:
        loc=locations['TH' if p['id']=='sample-point' else p['id']]
        if abs(p['latitude']-loc['lat'])>0.0001 or abs(p['longitude']-loc['lon'])>0.0001:raise ValueError('Wrong capital coordinate')
        if p['id'] in points:raise ValueError('Duplicate point')
        points[p['id']]=loc
    result=audit_csv(args.csv,points)
    result.update(checkedAt=datetime.now(timezone.utc).isoformat(),taskId=task['task_id'])
    Path(args.output).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:{name:v[name] for name in ['valid','total','missing','rejected','completeYears','currentTrendCoverageGate']} for k,v in result['locations'].items()}))


if __name__=='__main__':main()
