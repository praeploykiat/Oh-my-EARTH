import type { View } from './analysis/series';
import type { Place } from './geo';

export interface WorkbenchState {
  variable: string | null;
  place: Place | null;
  compare: Place | null;
  view: View;
}

const VIEWS: View[] = ['monthly', 'annual', 'anomaly'];
const PRECISION = 3;

function readPlace(params: URLSearchParams, prefix: string): Place | null {
  const lat = Number(params.get(`${prefix}lat`));
  const lon = Number(params.get(`${prefix}lon`));
  if (!params.has(`${prefix}lat`) || !params.has(`${prefix}lon`) || Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon, provinceCode: params.get(`${prefix}p`) };
}

function writePlace(params: URLSearchParams, prefix: string, place: Place | null) {
  if (!place) return;
  params.set(`${prefix}lat`, place.lat.toFixed(PRECISION));
  params.set(`${prefix}lon`, place.lon.toFixed(PRECISION));
  if (place.provinceCode) params.set(`${prefix}p`, place.provinceCode);
}

export function parseState(query: string): WorkbenchState {
  const params = new URLSearchParams(query);
  const view = params.get('view') as View | null;
  return {
    variable: params.get('v'),
    place: readPlace(params, ''),
    compare: readPlace(params, 'c'),
    view: view && VIEWS.includes(view) ? view : 'annual',
  };
}

export function serializeState(state: WorkbenchState): string {
  const params = new URLSearchParams();
  if (state.variable) params.set('v', state.variable);
  writePlace(params, '', state.place);
  writePlace(params, 'c', state.compare);
  if (state.view !== 'annual') params.set('view', state.view);
  return params.toString();
}

export function splitHash(hash: string): { path: string; query: string } {
  const raw = hash.replace(/^#/, '');
  const [path, query = ''] = raw.split('?');
  return { path: path || '/', query };
}
