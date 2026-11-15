"""Disabled sources must not require credentials or database access from their CLI."""
import os
import subprocess
import sys
import pytest
from src.observations import ROOT


@pytest.mark.parametrize('args',[
    ['enqueue-ndvi'],['run','--source','modis'],
    ['adopt','--id','196','--task-id','970961e5-ac1d-4652-9731-a0fc45b8dbd0']])
def test_disabled_source_commands_exit_before_connecting(args):
    result=subprocess.run([sys.executable,str(ROOT/'pipeline/worker.py'),*args],
      env={**os.environ,'DATABASE_URL':'postgresql://invalid.invalid/no_database'},capture_output=True,text=True,timeout=15)
    assert result.returncode==2
    assert 'AppEEARS/NDVI is disabled' in result.stderr
