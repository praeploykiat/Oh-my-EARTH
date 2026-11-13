import type { SeriesPoint } from './types';

export type RemoteService = 'giovanni' | 'datarods';

export interface RemoteDataset {
  service: RemoteService;
  id: string;
  scale: number;
}

export const GIOVANNI_HOME = 'https://giovanni.gsfc.nasa.gov/giovanni/';
export const HYDROLOGY_HOME = 'https://disc.gsfc.nasa.gov/information/tools?title=Hydrology%20Time%20Series';

const GIOVANNI_API = 'https://api.giovanni.earthdata.nasa.gov/timeseries';
const DATARODS_API = 'https://hydro1.gesdisc.eosdis.nasa.gov/daac-bin/access/timeseries.cgi';

export const REMOTE_DATASETS: Record<string, RemoteDataset> = {
  AOD: { service: 'giovanni', id: 'M2TMNXAER_5_12_4_TOTEXTTAU', scale: 1 },
  IMERG_RAIN: { service: 'giovanni', id: 'GPM_3IMERGM_07_precipitation', scale: 24 },
  SOIL_MOISTURE: { service: 'giovanni', id: 'GLDAS_NOAH025_M_2_1_SoilMoi0_10cm_inst', scale: 1 },
  RUNOFF: { service: 'datarods', id: 'GLDAS2:GLDAS_NOAH025_3H_v2.1:Qs_acc', scale: 8 },
  EVAPOTRANSPIRATION: { service: 'datarods', id: 'GLDAS2:GLDAS_NOAH025_3H_v2.1:Evap_tavg', scale: 86400 },
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;
const FILL_THRESHOLD = -9990;

// Parsing

function splitRow(line: string): [string, string] | null {
  const cells = line.includes(',') ? line.split(',') : line.trim().split(/\s+/);
  const time = cells[0]?.trim() ?? '';
  if (!DATE_PATTERN.test(time) || cells.length < 2) return null;
  return [time, cells[cells.length - 1].trim()];
}

export function parseTimeSeriesText(text: string, scale = 1): SeriesPoint[] {
  const months = new Map<string, { sum: number; count: number }>();

  for (const line of text.split(/\r?\n/)) {
    const row = splitRow(line);
    if (!row) continue;

    const [time, raw] = row;
    const value = Number(raw);
    const bucket = months.get(time.slice(0, 7)) ?? { sum: 0, count: 0 };
    if (raw !== '' && Number.isFinite(value) && value > FILL_THRESHOLD) {
      bucket.sum += value * scale;
      bucket.count += 1;
    }
    months.set(time.slice(0, 7), bucket);
  }

  return [...months.keys()].sort().map((t) => {
    const { sum, count } = months.get(t)!;
    return { t, value: count > 0 ? sum / count : null };
  });
}

export function fillMonths(series: SeriesPoint[], startYear: number, endYear: number): SeriesPoint[] {
  const byMonth = new Map(series.map((p) => [p.t, p.value]));
  const filled: SeriesPoint[] = [];
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const t = `${year}-${String(month).padStart(2, '0')}`;
      filled.push({ t, value: byMonth.get(t) ?? null });
    }
  }
  return filled;
}

// Upstream requests

export function upstreamUrl(dataset: RemoteDataset, lat: number, lon: number, startYear: number, endYear: number): string {
  if (dataset.service === 'giovanni') {
    const params = new URLSearchParams({
      data: dataset.id,
      location: `[${lat.toFixed(4)},${lon.toFixed(4)}]`,
      time: `${startYear}-01-01T00:00:00/${endYear}-12-31T23:59:59`,
    });
    return `${GIOVANNI_API}?${params}`;
  }

  const params = new URLSearchParams({
    variable: dataset.id,
    location: `GEOM:POINT(${lon.toFixed(4)}, ${lat.toFixed(4)})`,
    startDate: `${startYear}-01-01T00`,
    endDate: `${endYear}-12-31T21`,
    type: 'asc2',
  });
  return `${DATARODS_API}?${params}`;
}

// Links

export function proxyUrl(variable: string, lat: number, lon: number): string | null {
  const dataset = REMOTE_DATASETS[variable];
  if (!dataset) return null;
  const params = new URLSearchParams({ variable, lat: lat.toFixed(4), lon: lon.toFixed(4) });
  return `/api/${dataset.service}?${params}`;
}

export function giovanniLink(datasetId: string, lat: number, lon: number, startYear: number, endYear: number): string {
  const pad = 0.25;
  const bbox = [lon - pad, lat - pad, lon + pad, lat + pad].map((n) => n.toFixed(2)).join(',');
  return (
    `${GIOVANNI_HOME}#service=ArAvTs&starttime=${startYear}-01-01T00:00:00Z` +
    `&endtime=${endYear}-12-31T23:59:59Z&bbox=${bbox}&data=${datasetId}`
  );
}
