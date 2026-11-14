import { fetchWithTimeout } from './cache';

export const FLOOD_CONTEXT_VARIABLES = ['PRECTOTCORR', 'IMERG_RAIN', 'RUNOFF'];

export interface FloodYear {
  year: number;
  flooded: boolean;
}

export interface FloodHistory {
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  years: FloodYear[];
}

const TIMEOUT_MS = 30000;
const memory = new Map<string, Promise<FloodHistory>>();

export function fetchFloodHistory(lat: number, lon: number): Promise<FloodHistory> {
  const params = new URLSearchParams({ lat: lat.toFixed(4), lon: lon.toFixed(4) });
  const url = `/api/flood?${params}`;
  if (!memory.has(url)) {
    const pending = fetchWithTimeout(url, TIMEOUT_MS)
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as (FloodHistory & { error?: string }) | null;
        if (!response.ok || !body?.years) throw new Error(body?.error ?? `Flood service returned ${response.status}`);
        return body;
      })
      .catch((error: unknown) => {
        memory.delete(url);
        throw error;
      });
    memory.set(url, pending);
  }
  return memory.get(url)!;
}
