"""Private ingestion credentials. Values never enter artifacts or browser configuration."""
import os
from .observations import ROOT


def earthdata_token():
    value=os.environ.get('EARTHDATA_TOKEN','')
    if not value:
        for path in (ROOT/'web/.env',ROOT/'pipeline/.env',ROOT.parent/'nasa_source_tests/.env'):
            if path.exists():
                for line in path.read_text(encoding='utf-8-sig').splitlines():
                    key,sep,raw=line.strip().removeprefix('export ').partition('=')
                    if sep and key.strip()=='EARTHDATA_TOKEN':value=raw.strip().strip('"\'')
            if value:break
    if value.lower().startswith('bearer '):value=value[7:].strip()
    if not value or '\n' in value or '\r' in value:raise PermissionError('EARTHDATA_TOKEN is required for local ingestion')
    return value
