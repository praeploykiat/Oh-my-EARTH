export interface SeriesPoint {
  t: string;
  value: number | null;
}

export interface Dataset {
  id: string;
  variable: { key: string; label: string; description?: string };
  unit: string;
  source: { provider: string; product: string; url?: string; synthetic?: boolean };
  region: { name: string; lat: number; lon: number };
  resolution: 'monthly' | 'annual';
  series: SeriesPoint[];
  trend: {
    method: string;
    slopePerDecade: number;
    pValue: number;
    significant: boolean;
    alpha: number;
  };
}

export interface CatalogEntry {
  id: string;
  file: string;
  variable: string;
  region: string;
}

export interface Catalog {
  datasets: CatalogEntry[];
}
