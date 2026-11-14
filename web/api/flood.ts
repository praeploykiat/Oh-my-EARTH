export const maxDuration = 30;

const SPHERE_API = 'https://api.sphere.gistda.or.th/services/info/disasters/flood-recurrence';
const CACHE_HEADER = 'public, s-maxage=604800, stale-while-revalidate=86400';

interface SphereFloodArea {
  subdistrict_name?: string;
  district_name?: string;
  province_name?: string;
  total?: number;
  data?: { year: number; frequency: number }[];
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function coordinate(value: string | null, min: number, max: number): number | null {
  const parsed = Number(value);
  return value !== null && value !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const lat = coordinate(params.get('lat'), 5, 21);
  const lon = coordinate(params.get('lon'), 97, 106);
  if (lat === null || lon === null) return json({ error: 'Invalid coordinates' }, 400);

  const key = process.env.SPHERE_KEY?.trim();
  if (!key) return json({ error: 'SPHERE_KEY is not configured' }, 500);

  const query = new URLSearchParams({ lat: lat.toFixed(5), lon: lon.toFixed(5), key });
  let text: string;
  let status: number;
  try {
    const upstream = await fetch(`${SPHERE_API}?${query}`, { signal: AbortSignal.timeout(20_000) });
    status = upstream.status;
    text = await upstream.text();
  } catch (error) {
    return json({ error: 'GISTDA sphere could not be reached', detail: String(error) }, 502);
  }

  let areas: SphereFloodArea[];
  try {
    areas = JSON.parse(text) as SphereFloodArea[];
    if (!Array.isArray(areas)) throw new Error('Unexpected response');
  } catch {
    return json({ error: `GISTDA sphere returned ${status}`, detail: text.slice(0, 200) }, 502);
  }

  const area = areas[0];
  return json(
    {
      subdistrict: area?.subdistrict_name ?? null,
      district: area?.district_name ?? null,
      province: area?.province_name ?? null,
      years: (area?.data ?? []).map((d) => ({ year: d.year, flooded: d.frequency > 0 })),
    },
    200,
    { 'cache-control': CACHE_HEADER },
  );
}
