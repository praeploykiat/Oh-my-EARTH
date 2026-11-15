"""Real database snapshot and atomic publication tests; no NASA calls or bootstrap work."""
import copy
import json
import os
import pytest
from test_database import db
from test_observations import power_envelope, power_doc
from src.database import import_batch, seed_locations
from src.publication import capture, publish, write
from src.observations import power_batch

pytestmark = pytest.mark.skipif(os.environ.get('RUN_DATABASE_TESTS') != '1', reason='Requires disposable PostgreSQL database')


def test_current_release_excludes_archived_ndvi_observations(db,power_doc):
    from src.observations import ROOT,ndvi_batch
    seed_locations(db);import_batch(db,power_doc)
    import_batch(db,ndvi_batch(ROOT/'pipeline/fixtures/ndvi-pilot.json'))
    variables=capture(db)['capitals']['TH']['variables']
    assert set(variables)=={'T2M','PRECTOTCORR','RH2M','ALLSKY_SFC_SW_DWN'}
    assert db.execute("SELECT count(*) FROM earth.observations WHERE variable='NDVI'").fetchone()[0]==288


def test_gldas_and_power_keep_separate_units_cells_and_provenance(db,power_doc,tmp_path):
    from src.observations import gldas_batch
    from test_gldas import csv_text
    path=tmp_path/'TH.json';path.write_text(json.dumps({'requested':{'code':'TH','lat':13.75,'lon':100.52},'retrievedAt':'2026-11-15T00:00:00Z','csv':csv_text()}))
    seed_locations(db);import_batch(db,power_doc);import_batch(db,gldas_batch(path))
    variables=capture(db)['capitals']['TH']['variables']
    assert len(variables)==5
    assert variables['T2M']['responseCoordinates']=={'lat':13.75,'lon':100.52}
    assert variables['SOIL_MOISTURE']['responseCoordinates']=={'lat':13.875,'lon':100.625}
    assert variables['SOIL_MOISTURE']['unit']=='kg/m²'
    assert 'SoilMoi0_10cm_inst' in variables['SOIL_MOISTURE']['sourceUrl']


def summarize(source, stage):
    data=json.loads(source.read_text(encoding='utf-8'))
    maps={}
    for key in data['capitals']['TH']['variables']:
        file=f'maps/{key}/annual-2001.json'
        write(stage/file, {'releaseId':data['releaseId'],'records':{}})
        maps[key]={'annual':{'2001':file},'trend':{}}
    write(stage/'map-index.json',{'method':'seasonal-sen-cbb-v1','replicates':999,'seed':271828,'maps':maps})


def test_publication_is_atomic_immutable_and_unchanged_is_noop(db, power_doc, power_envelope, tmp_path):
    seed_locations(db);import_batch(db,power_doc)
    root=tmp_path/'cache'
    first=publish(db,root,summarize)
    previous=(root/'manifest.json').read_bytes()
    first_manifest=json.loads(previous)
    old_file=root/first_manifest['capitals']['TH']['path']
    old_data=old_file.read_bytes()
    def fail(*args): raise RuntimeError('Simulated failed summary build')
    assert publish(db,root,fail)['status']=='unchanged'
    newer=copy.deepcopy(power_envelope)
    newer['retrievedAt']='2026-11-16T00:00:00Z'
    newer['raw']['properties']['parameter']['T2M']['200101']=26
    path=tmp_path/'new.json';path.write_text(json.dumps(newer),encoding='utf-8')
    import_batch(db,power_batch(path))
    assert capture(db)['capitals']['TH']['variables']['T2M']['values'][0]==26
    with pytest.raises(RuntimeError):publish(db,root,fail)
    assert (root/'manifest.json').read_bytes()==previous
    second=publish(db,root,summarize)
    assert second['releaseId']!=first['releaseId']
    assert old_file.read_bytes()==old_data
    assert db.execute("SELECT count(*) FROM earth.cache_releases WHERE status='published'").fetchone()[0]==2


def test_invalid_statistical_method_never_publishes(db,power_doc,tmp_path):
    seed_locations(db);import_batch(db,power_doc)
    def wrong(source,stage):
        summarize(source,stage)
        index=json.loads((stage/'map-index.json').read_text())
        index['replicates']=99
        write(stage/'map-index.json',index)
    with pytest.raises(ValueError,match='validated production method'):
        publish(db,tmp_path/'cache',wrong)
    assert not (tmp_path/'cache/manifest.json').exists()
