import { END_YEAR, START_YEAR } from '../src/core/data/range.js';
import { fillMonths, parseTimeSeriesText, REMOTE_DATASETS, upstreamUrl, type RemoteProduct, type RemoteService } from '../src/core/data/remote.js';

type Found = { series: ReturnType<typeof parseTimeSeriesText>; product: string; lat: number; lon: number };
type Failed = { error: string; detail: string; status: number };
type Attempt = Found | Failed;

const NEIGHBOUR_STEPS = [
  [0, 0.25], [0, -0.25], [0.25, 0], [-0.25, 0],
  [0.25, 0.25], [0.25, -0.25], [-0.25, 0.25], [-0.25, -0.25],
];

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

  const token = process.env.EARTHDATA_TOKEN?.trim().replace(/^bearer\s+/i, '').replace(/^["']|["']$/g, '');
  if (!token) return json({ error: 'EARTHDATA_TOKEN is not configured' }, 500);

  const attempt = async (product: RemoteProduct, pointLat: number, pointLon: number): Promise<Attempt> => {
    try {
      const upstream = await fetch(upstreamUrl(product.id, pointLat, pointLon, START_YEAR, END_YEAR), {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(25_000),
      });
      const text = await upstream.text();
      const detail = `${product.id}: ${text.slice(0, 300)}`;
      if (!upstream.ok) return { error: `${service} returned ${upstream.status}`, detail, status: upstream.status };
      const series = parseTimeSeriesText(text, product.scale);
      if (series.every((p) => p.value === null)) return { error: `${service} returned no values`, detail, status: 204 };
      return { series, product: product.id, lat: pointLat, lon: pointLon };
    } catch (error) {
      return { error: `${service} could not be reached`, detail: `${product.id}: ${String(error)}`, status: 0 };
    }
  };

  const failures: Failed[] = [];
  for (const product of dataset.products) {
    let result = await attempt(product, lat, lon);
    if ('status' in result && result.status === 204) {
      const neighbours = await Promise.all(NEIGHBOUR_STEPS.map(([dLat, dLon]) => attempt(product, lat + dLat, lon + dLon)));
      result = neighbours.find((n): n is Found => 'series' in n) ?? result;
    }
    if ('series' in result) {
      return json(
        { series: fillMonths(result.series, START_YEAR, END_YEAR), product: result.product, lat: result.lat, lon: result.lon },
        200,
        { 'cache-control': CACHE_HEADER },
      );
    }
    failures.push(result);
    if (result.status !== 404) break;
  }

  const last = failures[failures.length - 1];
  return json({ error: last.error, detail: failures.map((f) => f.detail).join('\n') }, 502);
}
