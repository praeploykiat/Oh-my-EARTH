import type { SeriesPoint } from './types';

const memory = new Map<string, Promise<SeriesPoint[]>>();

// Session storage

function readStored(key: string): SeriesPoint[] | null {
  try {
    const stored = sessionStorage.getItem(key);
    return stored ? (JSON.parse(stored) as SeriesPoint[]) : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, series: SeriesPoint[]) {
  try {
    sessionStorage.setItem(key, JSON.stringify(series));
  } catch {
    return;
  }
}

// Requests

export async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function cachedSeries(key: string, load: () => Promise<SeriesPoint[]>): Promise<SeriesPoint[]> {
  const stored = readStored(key);
  if (stored) return Promise.resolve(stored);

  if (!memory.has(key)) {
    const pending = load()
      .then((series) => {
        writeStored(key, series);
        return series;
      })
      .catch((error: unknown) => {
        memory.delete(key);
        throw error;
      });
    memory.set(key, pending);
  }
  return memory.get(key)!;
}
