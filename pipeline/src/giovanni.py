"""Shared authenticated Giovanni extraction and source-specific monthly normalization."""
import calendar
import csv
import gzip
import io
import json
import math
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode
from .gldas import grid_cell,GldasHTTPError

SPECS={
 'AOD':{'product':'M2T1NXAER.5.12.4','name':'M2T1NXAER','version':'5.12.4','parameter':'TOTEXTTAU','api':'M2T1NXAER_5_12_4_TOTEXTTAU','doi':'10.5067/KLICLTZ8EM9D','unit':'1','fill':1e15,'resolution':[.5,.625],'scale':1,'bounds':[0,100]},
 'EVAPOTRANSPIRATION':{'product':'GLDAS_NOAH025_M.2.1','name':'GLDAS_NOAH025_M','version':'2.1','parameter':'Evap_tavg','api':'GLDAS_NOAH025_M_2_1_Evap_tavg','doi':'10.5067/SXAVCZFAQLNO','unit':'kg m-2 s-1','fill':-9999,'resolution':[.25,.25],'scale':86400,'bounds':[-100,100]}}


def request_url(variable,point):
 return 'https://api.giovanni.earthdata.nasa.gov/timeseries?'+urlencode({'data':SPECS[variable]['api'],'location':f"[{point['lat']:.4f},{point['lon']:.4f}]",'time':'2001-01-01T00:00:00/2024-12-31T23:59:59'})


def cell(variable,point):
 if variable!='AOD':return grid_cell(point)
 return {'lat':min(90,-90+math.floor((point['lat']+90)/.5+.5)*.5),'lon':-180+(math.floor((point['lon']+180)/.625+.5)%576)*.625}


def load(path):
 opener=gzip.open if str(path).endswith('.gz') else open
 with opener(path,'rt',encoding='utf-8') as stream:return json.load(stream)


def fetch(variable,point):
 import requests
 from .credentials import earthdata_token
 r=requests.get(request_url(variable,point),headers={'Authorization':'Bearer '+earthdata_token()},timeout=(10,120),allow_redirects=False)
 if r.status_code!=200:raise GldasHTTPError(r.status_code)
 return r.text


def parse(variable,text,point):
 s=SPECS[variable];metadata={};buckets={};seen=set();table=False
 for cells in csv.reader(io.StringIO(text)):
  if not cells or not any(c.strip() for c in cells):continue
  if cells==['Timestamp (UTC)','Data']:table=True;continue
  if len(cells)<2 or table and len(cells)!=2:raise ValueError('Malformed Giovanni row')
  key,raw=cells[0].strip(),','.join(cells[1:]).strip()
  if not table:
   if key in metadata:raise ValueError('Duplicate metadata')
   metadata[key]=raw;continue
  stamp=datetime.fromisoformat(key)
  if stamp.tzinfo or stamp.second or not 2001<=stamp.year<=2024 or stamp in seen:raise ValueError('Unexpected/duplicate timestamp')
  if variable=='AOD':
   if stamp.minute!=30:raise ValueError('Expected hourly midpoint')
  elif stamp.day!=1 or stamp.hour or stamp.minute:raise ValueError('Expected first-of-month timestamp')
  seen.add(stamp);month=stamp.strftime('%Y-%m');b=buckets.setdefault(month,{'sum':0.,'valid':0,'missing':0,'rejected':0,'rows':0});b['rows']+=1
  try:value=float(raw) if raw else None
  except ValueError:value=math.nan
  if value is None or value==s['fill']:b['missing']+=1
  elif not math.isfinite(value) or not s['bounds'][0]<=value*s['scale']<=s['bounds'][1]:b['rejected']+=1
  else:b['sum']+=value*s['scale'];b['valid']+=1
 if not table or not seen:raise ValueError('Empty data table')
 for key,expected in [('prod_name',s['product']),('doi',s['doi']),('param_short_name',s['parameter']),('unit',s['unit'])]:
  if metadata.get(key)!=expected:raise ValueError('Incorrect product/parameter/unit')
 if float(metadata.get('undef','nan'))!=s['fill']:raise ValueError('Incorrect fill value')
 expected=cell(variable,point)
 for key,res in zip(('lat','lon'),s['resolution']):
  value=float(metadata.get(key,'nan'))
  if not math.isfinite(value) or abs(value-expected[key])>1e-6 or float(metadata.get(key+'_resolution','nan'))!=res:raise ValueError('Incorrect model cell/resolution')
 begin='2001-01-01 00:30:00' if variable=='AOD' else '2001-01-01 00:00:00'
 end='2024-12-31 23:30:00' if variable=='AOD' else '2024-12-01 00:00:00'
 if metadata.get('begin_time')!=begin or metadata.get('end_time')!=end:raise ValueError('Incorrect source period')
 series=[];coverage={}
 for year in range(2001,2025):
  for month in range(1,13):
   key=f'{year}-{month:02d}';b=buckets.get(key,{'valid':0,'rows':0,'sum':0,'rejected':0});n=calendar.monthrange(year,month)[1]*24 if variable=='AOD' else 1
   if b['rows']>n:raise ValueError('Too many source timestamps')
   valid=b['valid']==n;quality='valid' if valid else 'rejected' if b['rejected'] else 'missing'
   series.append({'t':key,'value':b['sum']/n if valid else None,'quality':quality,'reason':None if valid else 'invalid_source_values' if b['rejected'] else 'incomplete_source_period'})
   coverage[key]={'expected':n,'present':b['rows'],'valid':b['valid']}
 return {'series':series,'metadata':metadata,'responseCoordinates':expected,'sourceRows':len(seen),'sourceCoverage':coverage}


def observation_batch(path):
 from .observations import catalog,batch,row,artifact,finite
 d=load(path);variable=d['variable'];s=SPECS[variable];point=d['requested'];loc=next(c for c in catalog() if c['code']==point['code'])
 if any(not finite(point[k]) or abs(point[k]-loc[k])>.00005 for k in ('lat','lon')):raise ValueError('Wrong requested capital')
 parsed=parse(variable,d['csv'],loc);c=parsed['responseCoordinates']
 product={'id':f"giovanni:{s['name']}:{s['version']}:{s['parameter']}",'source':'giovanni','name':s['name'],'version':s['version'],'source_url':'https://api.giovanni.earthdata.nasa.gov/','resolution':'0.5 x 0.625 degree hourly reanalysis' if variable=='AOD' else '0.25 degree monthly land model'}
 return batch(product,d['retrievedAt'],artifact(path),[loc],[row(loc,variable,p['t'],p['value'],p['quality'],p['reason'],source='giovanni') for p in parsed['series']],
  {'response_coordinates':[c['lon'],c['lat']],'request_url':request_url(variable,loc),'sources':[s['product'],s['parameter'],'DOI:'+s['doi'],'Giovanni point service'],
   'sourceRows':parsed['sourceRows'],'sourceCoverage':parsed['sourceCoverage'],'aggregation':'Complete hourly monthly mean' if variable=='AOD' else 'Monthly mean rate multiplied by 86400 to mm/day','source_unit':s['unit'],'neighbourFallback':False})
