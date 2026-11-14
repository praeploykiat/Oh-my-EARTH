import { analyzeGlobalTrend } from '../../core/stats/globalTrend';

self.onmessage = (event: MessageEvent<{ values: Array<number | null>; period: 1 | 12 }>) => {
  try { self.postMessage({ result: analyzeGlobalTrend(event.data.values, event.data.period) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
