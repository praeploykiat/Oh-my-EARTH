import { cachedSeries, fetchWithTimeout } from './cache';
import { proxyUrl } from './remote';
import type { SeriesPoint } from './types';

const TIMEOUT_MS = 60000;

export interface RemoteRequest {
  variable: string;
  lat: number;
  lon: number;
}

export function fetchRemoteMonthly({ variable, lat, lon }: RemoteRequest): Promise<SeriesPoint[]> {
  const url = proxyUrl(variable, lat, lon);
  if (!url) return Promise.reject(new Error(`No remote source for ${variable}`));

  return cachedSeries(`remote:${variable}:${lat.toFixed(2)}:${lon.toFixed(2)}`, async () => {
    const response = await fetchWithTimeout(url, TIMEOUT_MS);
    const body = (await response.json().catch(() => null)) as { series?: SeriesPoint[]; error?: string } | null;
    if (!response.ok || !body?.series) throw new Error(body?.error ?? `Data proxy returned ${response.status}`);
    return body.series;
  });
}
