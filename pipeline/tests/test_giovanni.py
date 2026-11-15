"""Synthetic fixtures testing hourly completeness and signed water-flux units."""
import calendar
import json
from datetime import datetime,timedelta
import pytest
from src.giovanni import SPECS,parse,observation_batch
from src.observations import MONTHS


def csv_text(variable,rows):
 s=SPECS[variable];hourly=variable=='AOD'
 header=[f'prod_name,{s["product"]}',f'doi,{s["doi"]}',f'param_short_name,{s["parameter"]}',
  f'unit,{s["unit"]}',f'undef,{s["fill"]}','param_name,Total aerosol, time average',
  'begin_time,2001-01-01 00:30:00' if hourly else 'begin_time,2001-01-01 00:00:00',
  'end_time,2024-12-31 23:30:00' if hourly else 'end_time,2024-12-01 00:00:00',
  'lat,14.0' if hourly else 'lat,13.875','lon,100.625',
  'lat_resolution,0.5' if hourly else 'lat_resolution,0.25','lon_resolution,0.625' if hourly else 'lon_resolution,0.25','Timestamp (UTC),Data']
 return '\n'.join(header+rows)


def et_csv():return csv_text('EVAPOTRANSPIRATION',[f'{m}-01 00:00,-0.000001' for m in MONTHS])


def test_et_signed_flux_conversion_identity_and_units(tmp_path):
 path=tmp_path/'TH.json';path.write_text(json.dumps({'variable':'EVAPOTRANSPIRATION','requested':{'code':'TH','lat':13.75,'lon':100.52},'retrievedAt':'2026-11-15T00:00:00Z','csv':et_csv()}))
 doc=observation_batch(path)
 assert len(doc['observations'])==288
 assert doc['observations'][0]['value']==pytest.approx(-.0864)
 assert doc['observations'][0]['unit']=='mm/day'
 assert doc['product']['source']=='giovanni'


def test_hourly_aod_requires_all_calendar_hours_and_does_not_include_fill():
 start=datetime(2004,2,1,0,30);rows=[f'{start+timedelta(hours=i):%Y-%m-%d %H:%M},0.2' for i in range(29*24)]
 result=parse('AOD',csv_text('AOD',rows),{'lat':13.75,'lon':100.52})
 feb=next(p for p in result['series'] if p['t']=='2004-02')
 assert feb['value']==pytest.approx(.2)
 assert result['sourceCoverage']['2004-02']=={'expected':696,'present':696,'valid':696}
 for bad in [rows[:-1],rows[:-1]+[rows[-1].replace(',0.2',',1e+15')]]:
  result=parse('AOD',csv_text('AOD',bad),{'lat':13.75,'lon':100.52})
  assert next(p for p in result['series'] if p['t']=='2004-02')['value'] is None
 with pytest.raises(ValueError):parse('AOD',csv_text('AOD',rows+[rows[0]]),{'lat':13.75,'lon':100.52})


@pytest.mark.parametrize('old,new',[('unit,kg m-2 s-1','unit,mm/day'),('Evap_tavg','PotEvap_tavg'),('lat,13.875','lat,14.125')])
def test_incompatible_metadata_is_rejected(old,new):
 with pytest.raises(ValueError):parse('EVAPOTRANSPIRATION',et_csv().replace(old,new),{'lat':13.75,'lon':100.52})
