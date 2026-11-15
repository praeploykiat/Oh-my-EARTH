import { useEffect, useState } from 'react';
import type { SeriesPoint } from '../../core/data';
import type { GlobalTrendResult } from '../../core/stats/globalTrend';

type TrendState = { status: 'loading' | 'unavailable' } | { status: 'error' } | { status: 'ready'; result: GlobalTrendResult };

export function useGlobalTrend(series: SeriesPoint[], annual: boolean, eligible: boolean): TrendState {
  const key = JSON.stringify([annual, eligible, series]);
  const [state, setState] = useState<{ key: string; data: TrendState }>({ key: '', data: { status: 'loading' } });
  useEffect(() => {
    if (!eligible) return;
    let active = true;
    let worker: Worker;
    try {
      worker = new Worker(new URL('./trend.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ result?: GlobalTrendResult; error?: string }>) => {
        if (active) setState({ key, data: event.data.result ? { status: 'ready', result: event.data.result } : { status: 'error' } });
      };
      worker.onerror = () => { if (active) setState({ key, data: { status: 'error' } }); };
      worker.postMessage({ values: series.map((point) => point.value), period: annual ? 1 : 12 });
    } catch { setState({ key, data: { status: 'error' } }); return; }
    return () => { active = false; worker.terminate(); };
  }, [key]);
  return !eligible ? { status: 'unavailable' } : state.key === key ? state.data : { status: 'loading' };
}
