"""Review-only CO2 ingestion rejects misleading coverage, units and daily gaps."""
import importlib.util
from pathlib import Path
import pytest

spec=importlib.util.spec_from_file_location('co2_review',Path(__file__).parents[1]/'co2_review.py')
review=importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)
POINT={'lat':13.75,'lon':100.52}


def fixture():
    header='''prod_name,OCO2_GEOS_L3CO2_DAY.10r
doi,10.5067/Y9M4NM9MPCGH
param_short_name,XCO2
unit,mol CO2/mol dry
undef,-999999
begin_time,2015-01-01 12:00:00
end_time,2022-02-28 12:00:00
lat,14.0
lon,100.625
lat_resolution,0.5
lon_resolution,0.625
Timestamp (UTC),Data
'''
    return header+'\n'.join(f'2016-02-{d:02d} 12:00,0.0004' for d in range(1,30))


def feb(text):
    return next(p for p in review.normalize(text,POINT)['series'] if p['t']=='2016-02')


def test_ppm_conversion_leap_days_and_missing_days():
    assert feb(fixture())['value']==pytest.approx(400)
    assert feb(fixture().replace('2016-02-29 12:00,0.0004',''))['value'] is None
    assert feb(fixture().replace('2016-02-29 12:00,0.0004','2016-02-29 12:00,-999999'))['value'] is None


@pytest.mark.parametrize('old,new',[('unit,mol CO2/mol dry','unit,ppm'),('lat,14.0','lat,13.0'),('0.0004','-0.0004'),('2016-02-29','2024-02-29')])
def test_identity_grid_bounds_and_period(old,new):
    with pytest.raises(ValueError):review.normalize(fixture().replace(old,new),POINT)


def test_duplicate_days_rejected():
    with pytest.raises(ValueError):review.normalize(fixture()+'\n2016-02-29 12:00,0.0004',POINT)
