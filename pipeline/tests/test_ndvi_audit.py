"""Synthetic QA bit examples; not evidence of live capital coverage."""
import csv
import pytest
from src.ndvi import LAYERS
from src.ndvi_audit import flags,failure_reasons,audit_csv


def test_cloud_and_shoreline_failures_have_distinct_causes():
    assert failure_reasons(flags(2048,0))==[]
    assert failure_reasons(flags(4096,0))==['landmask']
    assert set(failure_reasons(flags(2048|2,3)))=={'reliability','modland'}
    with pytest.raises(ValueError):flags('nan',0)


def test_audit_preserves_strict_qa_and_counts_overlapping_failures(tmp_path):
    path=tmp_path/'results.csv'
    with path.open('w',newline='') as stream:
        writer=csv.writer(stream)
        writer.writerow(['ID','Latitude','Longitude','Date']+['MOD13A3_061_'+x for x in LAYERS])
        for month,value,q,rel in [(1,.3,2048,0),(2,.4,4096,0),(3,.5,2050,3),(4,-3000,65535,-1)]:
            writer.writerow(['TH',13.75,100.52,f'2024-{month:02d}-01',value,q,rel])
    result=audit_csv(path,{'TH':{'code':'TH','lat':13.75,'lon':100.52}},start=2024,end=2024)['locations']['TH']
    assert result['valid']==1 and result['rejected']==2 and result['missing']==9
    assert result['diagnosticOnlyCounts']['strict_except_allow_shoreline']==2
    assert result['diagnosticOnlyCounts']['summary_good_or_marginal_only']==2
    assert sum(result['overlappingFailureReasons'].values())==3
    assert not result['currentTrendCoverageGate'] and result['completeYears']==0
