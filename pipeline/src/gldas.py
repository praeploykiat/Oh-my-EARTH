"""Giovanni monthly GLDAS retrieval and strict parsing, without neighbour substitution."""
import csv
import io
import math
from datetime import datetime
from urllib.parse import urlencode

PRODUCT='GLDAS_NOAH025_M.2.1'
VARIABLE='SoilMoi0_10cm_inst'
GIOVANNI_VARIABLE='GLDAS_NOAH025_M_2_1_SoilMoi0_10cm_inst'
DOI='10.5067/SXAVCZFAQLNO'


class GldasHTTPError(RuntimeError):
    def __init__(self,status):self.status=status;super().__init__(f'Giovanni HTTP {status}')


def fetch_csv(point,start=2001,end=2024):
    import requests
    from .credentials import earthdata_token
    response=requests.get(request_url(point,start,end),headers={'Authorization':'Bearer '+earthdata_token()},timeout=(10,60),allow_redirects=False)
    if response.status_code!=200:raise GldasHTTPError(response.status_code)
    return response.text


def request_url(point,start=2001,end=2024):
    return 'https://api.giovanni.earthdata.nasa.gov/timeseries?'+urlencode({
      'data':GIOVANNI_VARIABLE,'location':f"[{point['lat']:.4f},{point['lon']:.4f}]",
      'time':f'{start}-01-01T00:00:00/{end}-12-31T23:59:59'})


def grid_cell(point):
    # GLDAS land grid: cells begin at -60/-180 degrees, centers offset by 0.125.
    if not all(type(point[k]) in (float,int) and math.isfinite(point[k]) for k in ('lat','lon')):
        raise ValueError('Invalid requested coordinates')
    if not -60 <= point['lat'] < 90 or not -180 <= point['lon'] < 180:raise ValueError('Outside GLDAS grid')
    return {'lat':-59.875+math.floor((point['lat']+60)/.25)*.25,
            'lon':-179.875+math.floor((point['lon']+180)/.25)*.25}


def parse_csv(text,point,start=2001,end=2024):
    metadata={};values={};in_data=False
    for cells in csv.reader(io.StringIO(text)):
        if not cells or all(not c.strip() for c in cells):continue
        if cells==['Timestamp (UTC)','Data']:in_data=True;continue
        if len(cells)!=2:raise ValueError('Malformed Giovanni CSV row')
        key,value=[c.strip() for c in cells]
        if not in_data:
            if key in metadata:raise ValueError('Duplicate Giovanni metadata')
            metadata[key]=value;continue
        stamp=datetime.strptime(key,'%Y-%m-%d %H:%M')
        month=stamp.strftime('%Y-%m')
        if stamp.day!=1 or stamp.hour or stamp.minute or not start<=stamp.year<=end or month in values:
            raise ValueError('Unexpected or duplicate monthly timestamp')
        values[month]=value
    if not in_data or not values:raise ValueError('Missing monthly data table')
    if metadata.get('prod_name')!=PRODUCT or metadata.get('param_short_name')!=VARIABLE or metadata.get('doi')!=DOI:
        raise ValueError('Wrong GLDAS product or parameter')
    if metadata.get('unit') not in ('kg m-2','kg/m^2','kg/m²'):raise ValueError('Wrong soil moisture unit')
    if float(metadata.get('undef','nan'))!=-9999:raise ValueError('Unexpected fill metadata')
    if float(metadata.get('lat_resolution','nan'))!=.25 or float(metadata.get('lon_resolution','nan'))!=.25:
        raise ValueError('Unexpected GLDAS resolution')
    cell=grid_cell(point)
    if any(not math.isfinite(float(metadata.get(k,'nan'))) or abs(float(metadata[k])-cell[k])>1e-6 for k in ('lat','lon')):
        raise ValueError('Response cell differs from requested GLDAS grid cell')
    for field,expected in [('begin_time',f'{start}-01-01 00:00:00'),('end_time',f'{end}-12-01 00:00:00')]:
        if metadata.get(field)!=expected:raise ValueError('Unexpected response period')
    series=[];missing=[];rejected=[]
    for year in range(start,end+1):
        for month in range(1,13):
            key=f'{year}-{month:02d}';raw=values.get(key)
            try:value=float(raw) if raw is not None and raw.strip() else None
            except ValueError:value=math.nan
            quality='valid';reason=None
            if value is None or value==-9999:
                quality='missing';reason='absent_month' if raw is None else 'source_fill';value=None;missing.append(key)
            elif not math.isfinite(value) or not 0<=value<=100:
                quality='rejected';reason='source_screen';value=None;rejected.append(key)
            series.append({'t':key,'value':value,'quality':quality,'reason':reason})
    return {'series':series,'missing':missing,'rejected':rejected,'responseCoordinates':cell,
            'metadata':metadata,'sourceRows':len(values)}
