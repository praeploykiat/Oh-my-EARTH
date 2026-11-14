import { END_YEAR, START_YEAR } from '../src/core/data/range.js';
import { fillMonths, parseTimeSeriesText, REMOTE_DATASETS, upstreamUrl, type RemoteService } from '../src/core/data/remote.js';

const CACHE_HEADER = 'public, s-maxage=604800, stale-while-revalidate=86400';

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function coordinate(value: string | null, limit: number): number | null {
  const parsed = Number(value);
  return value !== null && value !== '' && Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
}

export async function proxy(request: Request, service: RemoteService): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const dataset = REMOTE_DATASETS[params.get('variable') ?? ''];
  const lat = coordinate(params.get('lat'), 90);
  const lon = coordinate(params.get('lon'), 180);

  if (!dataset || dataset.service !== service) return json({ error: 'Unknown variable' }, 400);
  if (lat === null || lon === null) return json({ error: 'Invalid coordinates' }, 400);

  const token = process.env.EARTHDATA_TOKEN;
  if (!token) return json({ error: 'EARTHDATA_TOKEN is not configured' }, 500);

  let upstream: Response;
  let text: string;
  try {
    upstream = await fetch(upstreamUrl(dataset, lat, lon, START_YEAR, END_YEAR), {
      headers: { authorization: `Bearer ${token}`, authorizationtoken: token },
      signal: AbortSignal.timeout(55_000),
    });
    text = await upstream.text();
  } catch (error) {
    return json({ error: `${service} could not be reached`, detail: String(error) }, 502);
  }
  if (!upstream.ok) return json({ error: `${service} returned ${upstream.status}`, detail: text.slice(0, 500) }, 502);

  const series = parseTimeSeriesText(text, dataset.scale);
  if (series.every((p) => p.value === null)) {
    return json({ error: `${service} returned no values`, detail: text.slice(0, 500) }, 502);
  }

  return json({ series: fillMonths(series, START_YEAR, END_YEAR) }, 200, { 'cache-control': CACHE_HEADER });
}
