import { geoCentroid, geoContains } from 'd3-geo';
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

let cached: Promise<ProvinceCollection> | null = null;

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

export function provinceCentroid(feature: ProvinceFeature): GeoPoint {
  const [lon, lat] = geoCentroid(feature);
  return { lat, lon };
}
