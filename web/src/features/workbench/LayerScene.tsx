import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { EARTH_LAYERS, useAsync, VARIABLES, type EarthLayer } from '../../core/data';
import { loadProvinceBoundaries, loadRegionNeighbors, provinceByCode, type GeoPoint, type Place } from '../../core/geo';
import { useI18n, type MessageKey } from '../../core/i18n';
import { Icon, type MapMarker } from '../../shared';

const DISPLAY_ORDER = [
  'AOD',
  'IMERG_RAIN',
  'PRECTOTCORR',
  'ALLSKY_SFC_SW_DWN',
  'T2M',
  'T2M_MAX',
  'T2M_MIN',
  'RH2M',
  'WS2M',
  'SOIL_MOISTURE',
  'RUNOFF',
  'EVAPOTRANSPIRATION',
];

const LAYER_TEXT: Record<EarthLayer, { name: MessageKey; hint: MessageKey }> = {
  atmosphere: { name: 'layer.atmosphere', hint: 'layer.atmosphereHint' },
  ground: { name: 'layer.ground', hint: 'layer.groundHint' },
  surface: { name: 'layer.surface', hint: 'layer.surfaceHint' },
};

function variablesIn(layer: EarthLayer) {
  return VARIABLES.filter((v) => v.layer === layer).sort(
    (a, b) => DISPLAY_ORDER.indexOf(a.key) - DISPLAY_ORDER.indexOf(b.key),
  );
}

// Layer label

function LayerLabel({ layer }: { layer: EarthLayer }) {
  const { t } = useI18n();
  return (
    <div className="layer-label">
      <span>{t(LAYER_TEXT[layer].name)}</span>
      <small>{t(LAYER_TEXT[layer].hint)}</small>
    </div>
  );
}

// Variable orbs

interface LayerRowProps {
  layer: EarthLayer;
  value: string;
  onChange: (key: string) => void;
}

function LayerRow({ layer, value, onChange }: LayerRowProps) {
  const { language, t } = useI18n();

  return (
    <div className={`layer layer-${layer}`} data-shell={layer === 'surface' ? undefined : layer}>
      <LayerLabel layer={layer} />
      <div className="orbs" role="radiogroup" aria-label={t(LAYER_TEXT[layer].name)}>
        {variablesIn(layer).map((variable) => (
          <button
            key={variable.key}
            type="button"
            role="radio"
            aria-checked={variable.key === value}
            className="orb"
            data-arc
            title={variable.description[language]}
            onClick={() => onChange(variable.key)}
          >
            <span className="orb-dot">
              <Icon name={variable.key} />
            </span>
            <span className="orb-label">{variable.label[language]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Geometry

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Geometry {
  width: number;
  cx: number;
  height: number;
  bounds: number[];
  map: Box | null;
}

const EARTH_RADIUS = 1.6;
const MAP_SHARE = 0.62;
const CURVED_QUERY = '(min-width: 961px)';

function bendAlongArc(items: HTMLElement[], origin: DOMRect, cx: number, width: number, earthTop: number) {
  const cy = earthTop + width * EARTH_RADIUS;
  for (const item of items) {
    const box = item.getBoundingClientRect();
    const x = box.left + box.width / 2 - origin.left;
    const r = cy - (box.top - origin.top);
    const dx = Math.min(Math.abs(x - cx), r);
    item.style.transform = `translateY(${(r - Math.sqrt(r * r - dx * dx)).toFixed(1)}px)`;
  }
}

function useGeometry(ref: RefObject<HTMLDivElement>): Geometry | null {
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  useLayoutEffect(() => {
    const scene = ref.current;
    if (!scene) return;
    const measure = () => {
      const arcItems = [...scene.querySelectorAll<HTMLElement>('[data-arc]')];
      arcItems.forEach((item) => (item.style.transform = ''));
      const origin = scene.getBoundingClientRect();
      const rows = [...scene.querySelectorAll<HTMLElement>('[data-shell]')];
      const space = scene.querySelector<HTMLElement>('[data-map-space]')?.getBoundingClientRect();
      const top = rows[0] ? rows[0].getBoundingClientRect().top - origin.top : 0;
      const bounds = [top, ...rows.map((row) => row.getBoundingClientRect().bottom - origin.top)];
      const cx = (scene.clientWidth - parseFloat(getComputedStyle(scene).paddingRight || '0')) / 2;
      if (window.matchMedia(CURVED_QUERY).matches && bounds[2] !== undefined) {
        bendAlongArc(arcItems, origin, cx, scene.clientWidth, bounds[2]);
      }
      setGeometry({
        width: scene.clientWidth,
        cx,
        height: scene.clientHeight,
        bounds,
        map: space
          ? {
              x0: space.left - origin.left,
              y0: space.top - origin.top,
              x1: space.right - origin.left,
              y1: space.bottom - origin.top,
            }
          : null,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scene);
    return () => observer.disconnect();
  }, [ref]);

  return geometry;
}

// Earth

interface EarthProps extends Geometry {
  selected: Place | null;
  markers: MapMarker[];
  onPlace: (place: Place) => void;
}

function Earth({ width, cx, height, bounds, map, selected, markers, onPlace }: EarthProps) {
  const { language, t } = useI18n();
  const provinces = useAsync(loadProvinceBoundaries, []);
  const neighbors = useAsync(loadRegionNeighbors, []);
  const [hoverCode, setHoverCode] = useState<string | null>(null);

  const [atmosphereTop, atmosphereBottom, earthTop] = bounds;
  const radius = width * EARTH_RADIUS;
  const cy = (earthTop ?? 0) + radius;

  const projection = useMemo(() => {
    if (!map || provinces.status !== 'ready') return null;
    const half = ((map.x1 - map.x0) * MAP_SHARE) / 2;
    const center = Math.min(Math.max(cx, map.x0 + half), map.x1 - half);
    return geoMercator().fitExtent(
      [
        [center - half, map.y0],
        [center + half, map.y1],
      ],
      provinces.data,
    );
  }, [cx, map?.x0, map?.y0, map?.x1, map?.y1, provinces.status]);

  if (earthTop === undefined) return null;

  const path = projection ? geoPath(projection) : null;
  const project = (point: GeoPoint) => projection?.([point.lon, point.lat]) ?? [0, 0];

  const pick = (event: MouseEvent<SVGPathElement>, code: string) => {
    if (!projection?.invert) return;
    const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const coords = projection.invert([event.clientX - box.left, event.clientY - box.top]);
    if (coords) onPlace({ lon: coords[0], lat: coords[1], provinceCode: code });
  };

  const labelCode = hoverCode ?? selected?.provinceCode ?? null;
  const label = labelCode ? provinceByCode(labelCode)?.[language] : t('map.hint');

  return (
    <svg className="scene-sky" width={width} height={height} role="img" aria-label={t('map.label')}>
      <defs>
        <radialGradient id="scene-earth" cx={cx} cy={earthTop} r={radius * 0.9} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1c4a3f" />
          <stop offset="0.35" stopColor="#143630" />
          <stop offset="1" stopColor="#0d1f1c" />
        </radialGradient>
        <clipPath id="scene-earth-clip">
          <circle cx={cx} cy={cy} r={radius} />
        </clipPath>
      </defs>

      <circle cx={cx} cy={cy} r={cy - atmosphereTop} fill="rgba(79, 209, 165, 0.04)" stroke="#ffffff" strokeOpacity={0.1} />
      <circle cx={cx} cy={cy} r={cy - atmosphereBottom} fill="rgba(79, 209, 165, 0.07)" stroke="#ffffff" strokeOpacity={0.12} />
      <circle cx={cx} cy={cy} r={radius + 14} fill="rgba(127, 224, 192, 0.1)" />
      <circle cx={cx} cy={cy} r={radius} fill="url(#scene-earth)" />

      {path && (
        <g clipPath="url(#scene-earth-clip)">
          {neighbors.status === 'ready' &&
            neighbors.data.features.map((feature) => (
              <path key={feature.properties.name} d={path(feature) ?? undefined} className="earth-neighbor" />
            ))}
          {provinces.status === 'ready' &&
            provinces.data.features.map((feature) => {
              const code = feature.properties.code;
              return (
                <path
                  key={code}
                  d={path(feature) ?? undefined}
                  className={`map-province ${selected?.provinceCode === code ? 'is-selected' : ''}`}
                  onMouseEnter={() => setHoverCode(code)}
                  onMouseLeave={() => setHoverCode(null)}
                  onClick={(event) => pick(event, code)}
                />
              );
            })}
          {markers.map((marker) => {
            const [x, y] = project(marker);
            return (
              <g key={marker.id} className="map-marker" transform={`translate(${x}, ${y})`}>
                <title>{marker.label}</title>
                <circle r={5} />
              </g>
            );
          })}
          {selected && (
            <g className="map-pin" transform={`translate(${project(selected).join(',')})`}>
              <circle r={10} className="map-pin-ring" />
              <circle r={3.5} />
            </g>
          )}
        </g>
      )}

      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(127, 224, 192, 0.7)" strokeWidth={2} />

      {map && (
        <text x={map.x0} y={map.y0 + 4} className="earth-caption">
          {label}
          {selected && !hoverCode ? `  ${selected.lat.toFixed(2)}°N ${selected.lon.toFixed(2)}°E` : ''}
        </text>
      )}
    </svg>
  );
}

// Scene

interface LayerSceneProps {
  variable: string;
  onVariable: (key: string) => void;
  selected: Place | null;
  markers: MapMarker[];
  onPlace: (place: Place) => void;
  placeControls: ReactNode;
}

export function LayerScene({ variable, onVariable, selected, markers, onPlace, placeControls }: LayerSceneProps) {
  const [atmosphere, ground, surface] = EARTH_LAYERS;
  const ref = useRef<HTMLDivElement>(null);
  const geometry = useGeometry(ref);

  return (
    <div className="scene" ref={ref}>
      {geometry && <Earth {...geometry} selected={selected} markers={markers} onPlace={onPlace} />}
      <LayerRow layer={atmosphere} value={variable} onChange={onVariable} />
      <LayerRow layer={ground} value={variable} onChange={onVariable} />
      <div className="scene-earth">
        <LayerRow layer={surface} value={variable} onChange={onVariable} />
        <div className="scene-ground">
          <div className="scene-map-space" data-map-space />
          <div className="scene-places">{placeControls}</div>
        </div>
      </div>
    </div>
  );
}
