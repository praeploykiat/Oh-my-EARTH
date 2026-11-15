"""Synthetic monthly CSV fixtures; live evidence is recorded separately."""
import json
import pytest
from src.gldas import parse_csv,grid_cell
from src.observations import MONTHS,gldas_batch


def csv_text():
    return '\n'.join(['prod_name,GLDAS_NOAH025_M.2.1','doi,10.5067/SXAVCZFAQLNO',
      'param_short_name,SoilMoi0_10cm_inst','unit,kg m-2','undef,-9999',
      'begin_time,2001-01-01 00:00:00','end_time,2024-12-01 00:00:00',
      'lat,13.875','lon,100.625','lat_resolution,0.25','lon_resolution,0.25','',
      'Timestamp (UTC),Data',*[f'{m}-01 00:00,35' for m in MONTHS]])


def test_containing_cell_and_mass_units_are_preserved(tmp_path):
    path=tmp_path/'TH.json';path.write_text(json.dumps({'requested':{'code':'TH','lat':13.75,'lon':100.52},'retrievedAt':'2026-11-15T00:00:00Z','csv':csv_text()}))
    doc=gldas_batch(path)
    assert len(doc['observations'])==288 and doc['observations'][0]['value']==35
    assert doc['observations'][0]['unit']=='kg/m²'
    assert doc['metadata']['response_coordinates']==[100.625,13.875]
    assert grid_cell({'lat':-35.27,'lon':149.13})=={'lat':-35.375,'lon':149.125}


@pytest.mark.parametrize('old,new',[('kg m-2','percent'),('GLDAS_NOAH025_M.2.1','GLDAS_NOAH025_M.2.0'),
 ('SoilMoi0_10cm_inst','SoilMoi10_40cm_inst'),('lat,13.875','lat,14.125'),('lat_resolution,0.25','lat_resolution,1.0'),
 ('2024-12-01 00:00:00','2023-12-01 00:00:00')])
def test_wrong_product_units_depth_grid_or_period_are_rejected(old,new):
    with pytest.raises(ValueError):parse_csv(csv_text().replace(old,new),{'lat':13.75,'lon':100.52})


def test_fill_rejected_and_absent_months_remain_gaps():
    text=csv_text().replace('2001-01-01 00:00,35','2001-01-01 00:00,-9999').replace('2001-02-01 00:00,35','2001-02-01 00:00,NaN').replace('2001-03-01 00:00,35\n','')
    result=parse_csv(text,{'lat':13.75,'lon':100.52})
    assert result['missing']==['2001-01','2001-03'] and result['rejected']==['2001-02']
    with pytest.raises(ValueError):parse_csv(csv_text()+'\n2001-01-01 00:00,35',{'lat':13.75,'lon':100.52})
