"""Offline MOD13A3 QA diagnostics. Alternative counts never change production screening."""
import csv
import hashlib
import math
from collections import Counter
from pathlib import Path
from .ndvi import LAYERS, QA_POLICY, read_point_csv, valid_quality


def flags(quality, reliability):
    q, r = float(quality), float(reliability)
    if not all(math.isfinite(x) and x.is_integer() for x in (q, r)) or not 0 <= q < 65535:
        raise ValueError('Invalid QA code')
    q, r = int(q), int(r)
    return {'reliability':r,'modland':q & 3,'landmask':(q >> 11) & 7,
            'usefulness':(q >> 2) & 15,'aerosol':(q >> 6) & 3,
            'adjacent_cloud':(q >> 8) & 1,'mixed_cloud':(q >> 10) & 1,
            'snow':(q >> 14) & 1,'shadow':(q >> 15) & 1}


def failure_reasons(f):
    return [key for key in ('reliability','modland','landmask','adjacent_cloud','mixed_cloud','snow','shadow')
            if f[key] != (1 if key == 'landmask' else 0)]


def audit_csv(path, points, *, start=2001, end=2024):
    path=Path(path)
    parsed=read_point_csv(path,points,start=start,end=end)
    output={key:{'point':point,'flagCounts':{name:Counter() for name in flags(2048,0)},
                  'overlappingFailureReasons':Counter(),'failureCombinations':Counter(),
                  'diagnosticOnlyCounts':Counter()} for key,point in points.items()}
    with path.open(encoding='utf-8-sig',newline='') as stream:
        reader=csv.DictReader(stream)
        cols=[next(c for c in reader.fieldnames if c.startswith('MOD13A3_061_') and c.endswith(layer)) for layer in LAYERS]
        for row in reader:
            record=output[row['ID']]
            if not row[cols[0]].strip() or float(row[cols[0]]) == -3000:continue
            try:f=flags(row[cols[1]],row[cols[2]])
            except ValueError:
                record['overlappingFailureReasons']['invalid_qa']+=1
                record['failureCombinations']['invalid_qa']+=1
                continue
            for name,value in f.items():record['flagCounts'][name][str(value)]+=1
            failed=failure_reasons(f)
            record['overlappingFailureReasons'].update(failed)
            record['failureCombinations']['+'.join(failed) or 'accepted']+=1
            counts=record['diagnosticOnlyCounts']
            counts['summary_good_only']+=int(f['reliability']==0)
            counts['summary_good_or_marginal_only']+=int(f['reliability'] in (0,1))
            counts['strict_except_allow_shoreline']+=int(not [x for x in failed if x!='landmask'] and f['landmask'] in (1,2))
            counts['strict_except_allow_marginal']+=int(not [x for x in failed if x!='reliability'] and f['reliability'] in (0,1))
            assert (not failed)==valid_quality(int(float(row[cols[1]])),int(float(row[cols[2]])))
    for key,result in output.items():
        source=parsed[key]
        series=source['series'];valid=source['valid'];total=source['total']
        years={str(year):sum(p['value'] is not None for p in series if p['t'].startswith(str(year))) for year in range(start,end+1)}
        result.update({'valid':valid,'total':total,'sourceRows':source['sourceRows'],'missing':len(source['missing']),
          'rejected':len(source['rejected']),'coverageFraction':valid/total,'validMonthsPerYear':years,
          'validMonthsByCalendarMonth':{str(month):sum(p['value'] is not None for p in series if int(p['t'][5:])==month) for month in range(1,13)},
          'completeYears':sum(n==12 for n in years.values()),
          'currentTrendCoverageGate':end-start+1>=10 and sum(n>0 for n in years.values())>=10 and valid/total>=0.8,
          'ndviRangeBeforeQA':[min(float(p['value']) for p in series if p['value'] is not None),max(float(p['value']) for p in series if p['value'] is not None)] if valid else None})
        # This range is strictly the retained values, not a claim about rejected observations.
        result['retainedNDVIRange']=result.pop('ndviRangeBeforeQA')
    return {'product':'MOD13A3.061','period':{'start':start,'end':end},'qaPolicy':QA_POLICY,
            'csvSHA256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'diagnosticWarning':'Alternative counts are sensitivity diagnostics, not approved QA policies or publishable observations.',
            'locations':output}
