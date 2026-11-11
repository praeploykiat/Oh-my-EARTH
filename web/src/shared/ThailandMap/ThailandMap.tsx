import { useMemo, useState, type MouseEvent } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import {
  loadProvinceBoundaries,
  provinceAt,
  provinceByCode,
  type GeoPoint,
  type Place,
  type ProvinceCollection,
} from '../../core/geo';
import { useAsync } from '../../core/data';
import { useI18n } from '../../core/i18n';
import { StatusMessage } from '../StatusMessage';

export interface MapMarker extends GeoPoint {
  id: string;
  label: string;
}

interface ThailandMapProps {
  selected?: Place | null;
  markers?: MapMarker[];
  activeMarkerId?: string | null;
  onSelectPlace?: (place: Place) => void;
  onSelectMarker?: (id: string) => void;
}

const WIDTH = 320;
const HEIGHT = 560;
const PAD = 8;

export function ThailandMap(props: ThailandMapProps) {
  const boundaries = useAsync(loadProvinceBoundaries, []);
  if (boundaries.status !== 'ready') return <StatusMessage state={boundaries} />;
  return <MapCanvas boundaries={boundaries.data} {...props} />;
}

// Rendering

function MapCanvas({
  boundaries,
  selected,
  markers = [],
  activeMarkerId,
  onSelectPlace,
  onSelectMarker,
}: ThailandMapProps & { boundaries: ProvinceCollection }) {
  const { language, t } = useI18n();
  const [hoverCode, setHoverCode] = useState<string | null>(null);

  const { projection, path } = useMemo(() => {
    const proj = geoMercator().fitExtent(
      [
        [PAD, PAD],
        [WIDTH - PAD, HEIGHT - PAD],
      ],
      boundaries,
    );
    return { projection: proj, path: geoPath(proj) };
  }, [boundaries]);

  const project = (point: GeoPoint) => projection([point.lon, point.lat]) ?? [0, 0];

  const handleClick = (event: MouseEvent<SVGSVGElement>) => {
    if (!onSelectPlace) return;
    const svg = event.currentTarget;
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * WIDTH;
    const y = ((event.clientY - box.top) / box.height) * HEIGHT;
    const coords = projection.invert?.([x, y]);
    if (!coords) return;

    const point = { lon: coords[0], lat: coords[1] };
    const province = provinceAt(boundaries, point);
    if (!province) return;
    onSelectPlace({ ...point, provinceCode: province.properties.code });
  };

  const provinceName = (code: string | null | undefined) => {
    const province = code ? provinceByCode(code) : undefined;
    return province ? province[language] : null;
  };

  const label = provinceName(hoverCode) ?? provinceName(selected?.provinceCode);

  return (
    <figure className="thailand-map">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={t('map.label')}
        onClick={handleClick}
        onMouseLeave={() => setHoverCode(null)}
      >
        <g className="map-provinces">
          {boundaries.features.map((feature) => {
            const code = feature.properties.code;
            const isSelected = selected?.provinceCode === code;
            return (
              <path
                key={code}
                d={path(feature) ?? undefined}
                className={`map-province ${isSelected ? 'is-selected' : ''}`}
                onMouseEnter={() => setHoverCode(code)}
              />
            );
          })}
        </g>

        {markers.map((marker) => {
          const [x, y] = project(marker);
          const isActive = marker.id === activeMarkerId;
          return (
            <g
              key={marker.id}
              className={`map-marker ${isActive ? 'is-active' : ''}`}
              transform={`translate(${x}, ${y})`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectMarker?.(marker.id);
              }}
            >
              <title>{marker.label}</title>
              <circle r={isActive ? 7 : 5} />
            </g>
          );
        })}

        {selected && (
          <g className="map-pin" transform={`translate(${project(selected).join(',')})`}>
            <circle r={10} className="map-pin-ring" />
            <circle r={3.5} />
          </g>
        )}
      </svg>

      <figcaption className="map-caption">
        {label ?? t('map.hint')}
        {selected && !hoverCode && (
          <span>
            {selected.lat.toFixed(2)}°, {selected.lon.toFixed(2)}°
          </span>
        )}
      </figcaption>
    </figure>
  );
}
