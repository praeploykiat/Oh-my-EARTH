"""Shared release policy. Deferred source code and local observations remain preserved."""
import json
from .observations import ROOT

SOURCE_SETTINGS=json.loads((ROOT/'web/src/features/global/sourceSettings.json').read_text(encoding='utf-8'))
ENABLED_SOURCES=tuple(SOURCE_SETTINGS['enabledSources'])
