import { useEffect, useState } from 'react';
import type { View } from '../../core/analysis';
import { loadFeaturedCases, type FeaturedCase } from '../../core/data';
import type { Place } from '../../core/geo';
import { useI18n, type MessageKey } from '../../core/i18n';
import { parseState, serializeState, splitHash, type WorkbenchState } from '../../core/url';
import { InfoTip, type MapMarker } from '../../shared';
import { PlacePicker } from './Controls';
import { FeaturedCases } from './FeaturedCases';
import { LayerScene } from './LayerScene';
import { placeName } from './placeName';
import { ResultPanel } from './ResultPanel';

const DEFAULT_VARIABLE = 'T2M';
const VIEWS: Array<{ view: View; label: MessageKey }> = [
  { view: 'annual', label: 'view.annual' },
  { view: 'monthly', label: 'view.monthly' },
  { view: 'anomaly', label: 'view.anomaly' },
];

function readStateFromUrl(): WorkbenchState {
  return parseState(splitHash(window.location.hash).query);
}

function onWorkbench(): boolean {
  return splitHash(window.location.hash).path === '/workbench';
}

function writeStateToUrl(state: WorkbenchState) {
  if (!onWorkbench()) return;
  const query = serializeState(state);
  const hash = `#/workbench${query ? `?${query}` : ''}`;
  if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
}

function samePlace(a: Place | null, b: Place | null): boolean {
  return Boolean(a && b && a.lat === b.lat && a.lon === b.lon);
}

export function Workbench() {
  const { language, t } = useI18n();
  const [state, setState] = useState<WorkbenchState>(readStateFromUrl);
  const [comparing, setComparing] = useState(Boolean(state.compare));
  const [activeCase, setActiveCase] = useState<string | null>(null);
  const [target, setTarget] = useState<'place' | 'compare'>('place');

  useEffect(() => writeStateToUrl(state), [state]);

  useEffect(() => {
    const onHashChange = () => {
      if (!onWorkbench()) return;
      const next = readStateFromUrl();
      setState(next);
      setComparing(Boolean(next.compare));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (state.place) return;
    loadFeaturedCases()
      .then((cases) => cases[0] && openCase(cases[0]))
      .catch(() => undefined);
  }, []);

  const update = (patch: Partial<WorkbenchState>) => {
    setState((current) => ({ ...current, ...patch }));
    setActiveCase(null);
  };

  function openCase(featured: FeaturedCase) {
    setState((current) => ({ ...current, variable: featured.variable, place: featured.place }));
    setActiveCase(featured.id);
  }

  const variable = state.variable ?? DEFAULT_VARIABLE;
  const places = [state.place, comparing ? state.compare : null].filter((p): p is Place => p !== null);
  const mapTarget = comparing ? target : 'place';
  const otherPlace = mapTarget === 'place' ? (comparing ? state.compare : null) : state.place;
  const markers: MapMarker[] = otherPlace
    ? [{ id: 'other', label: placeName(otherPlace, language), lat: otherPlace.lat, lon: otherPlace.lon }]
    : [];

  const startCompare = () => {
    setComparing(true);
    setTarget('compare');
  };

  const stopCompare = () => {
    setComparing(false);
    setTarget('place');
    update({ compare: null });
  };

  const placeControls = (
    <>
      <PlacePicker
        label={t('workbench.place')}
        value={state.place}
        active={comparing && mapTarget === 'place'}
        onFocus={() => setTarget('place')}
        onChange={(place) => update({ place })}
      />
      {comparing ? (
        <PlacePicker
          label={t('workbench.comparePlace')}
          value={state.compare}
          active={mapTarget === 'compare'}
          onFocus={() => setTarget('compare')}
          onChange={(compare) => update({ compare })}
          onRemove={stopCompare}
        />
      ) : (
        <button type="button" className="button-secondary button-compact add-compare" onClick={startCompare}>
          + {t('workbench.compare')}
        </button>
      )}
      {comparing && <p className="map-target-hint">{t('workbench.mapTarget')}</p>}
    </>
  );

  return (
    <section className="workbench">
      <header className="workbench-top">
        <div className="workbench-title">
          <h1>{t('workbench.question')}</h1>
          <p>{t('workbench.intro')}</p>
        </div>
        <FeaturedCases activeId={activeCase} onOpen={openCase} />
      </header>

      <div className="bench">
        <LayerScene
          variable={variable}
          onVariable={(key) => update({ variable: key })}
          selected={mapTarget === 'place' ? state.place : state.compare}
          markers={markers}
          onPlace={(place) => update(mapTarget === 'place' ? { place } : { compare: place })}
          placeControls={placeControls}
        />

        <div className="bench-results">
          {places.length === 0 ? (
            <div className="result-state">{t('workbench.pickPlace')}</div>
          ) : (
            <>
              <div className="segmented" role="radiogroup" aria-label={t('view.label')}>
                {VIEWS.map(({ view, label }) => (
                  <button
                    key={view}
                    type="button"
                    role="radio"
                    aria-checked={state.view === view}
                    onClick={() => setState((current) => ({ ...current, view }))}
                  >
                    {t(label)}
                  </button>
                ))}
                <InfoTip text={t('info.anomaly')} />
              </div>

              {places.map((place, i) =>
                i > 0 && samePlace(place, places[0]) ? null : (
                  <ResultPanel key={`${place.lat},${place.lon}`} variable={variable} place={place} view={state.view} />
                ),
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
