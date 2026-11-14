import { geoCentroid, geoContains, geoDistance } from 'd3-geo';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

export interface ProvinceProperties {
  code: string;
}

export type ProvinceFeature = Feature<Polygon | MultiPolygon, ProvinceProperties>;
export type ProvinceCollection = FeatureCollection<Polygon | MultiPolygon, ProvinceProperties>;

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface Place extends GeoPoint {
  provinceCode: string | null;
}

const BOUNDARIES_URL = `${import.meta.env.BASE_URL}geo/thailand-provinces.json`;
const NEIGHBORS_URL = `${import.meta.env.BASE_URL}geo/region-neighbors.json`;

export type RegionCollection = FeatureCollection<Polygon | MultiPolygon, { name: string }>;

let cached: Promise<ProvinceCollection> | null = null;
let neighbors: Promise<RegionCollection> | null = null;

export function loadRegionNeighbors(): Promise<RegionCollection> {
  neighbors ??= fetch(NEIGHBORS_URL).then((response) => {
    if (!response.ok) throw new Error(`Failed to load ${NEIGHBORS_URL}: ${response.status}`);
    return response.json() as Promise<RegionCollection>;
  });
  return neighbors;
}

export function loadProvinceBoundaries(): Promise<ProvinceCollection> {
  cached ??= fetch(BOUNDARIES_URL).then((response) => {
    if (!response.ok) throw new Error(`Failed to load ${BOUNDARIES_URL}: ${response.status}`);
    return response.json() as Promise<ProvinceCollection>;
  });
  return cached;
}

export function provinceAt(collection: ProvinceCollection, point: GeoPoint): ProvinceFeature | undefined {
  return collection.features.find((feature) => geoContains(feature, [point.lon, point.lat]));
}

export function nearestProvince(collection: ProvinceCollection, point: GeoPoint): ProvinceFeature | undefined {
  const inside = provinceAt(collection, point);
  if (inside) return inside;

  let best: ProvinceFeature | undefined;
  let bestDistance = Infinity;
  for (const feature of collection.features) {
    const distance = geoDistance([point.lon, point.lat], geoCentroid(feature));
    if (distance < bestDistance) {
      best = feature;
      bestDistance = distance;
    }
  }
  return best;
}

export function provinceCentroid(feature: ProvinceFeature): GeoPoint {
  const [lon, lat] = geoCentroid(feature);
  return { lat, lon };
}
