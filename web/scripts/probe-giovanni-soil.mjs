// Opt-in live pilot, run from web/: node scripts/probe-giovanni-soil.mjs
// Existing generated credential only; no .env changes and no credential logging.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer, loadEnv } from 'vite';
const output = path.resolve('../docs/global-giovanni-pilot.json');
const rawDirectory = path.resolve('../pipeline/raw/global-giovanni-pilot');
const env = loadEnv('development', process.cwd(), '');
const configured = process.env.EARTHDATA_TOKEN || env.EARTHDATA_TOKEN;
if (configured) process.env.EARTHDATA_TOKEN = configured;
const token = configured?.trim().replace(/^bearer\s+/i, '').replace(/^["']|["']$/g, '');
const report = { checkedAt: new Date().toISOString(), candidate: { variable: 'SOIL_MOISTURE', source: 'GLDAS Noah 2.1 via NASA Giovanni', depth: '0-10 cm', expectedUnit: 'kg/m²', nativeResolution: '0.25 degrees', temporalResolution: 'monthly', requestedPeriod: '2001–2024' }, credentialConfigured: Boolean(token), scope: 'Live access pilot, not validation of every capital or measurement accuracy. Existing credentials are unchanged. HTTP 500 does not prove a token is invalid.', checks: [] };
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const clean = (value) => token ? String(value).replaceAll(token, '[redacted]') : String(value);
const note = (row) => { report.checks.push(row); console.log(`${row.check}: ${row.status ?? row.httpStatus ?? 'unknown'}`); };
async function request(url, authenticated = true) {
  const start = performance.now();
  try {
    const response = await fetch(url, { headers: authenticated && token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(30_000) });
    const text = await response.text();
    let errorBody;
    if (!response.ok) {
      try { const json = JSON.parse(text); errorBody = { message: typeof json.message === 'string' ? clean(json.message).slice(0, 160) : null }; }
      catch { errorBody = { message: 'Non-JSON error body omitted' }; }
    }
    return { httpStatus: response.status, elapsedMs: Math.round(performance.now() - start), text, errorBody };
  } catch (error) { return { httpStatus: null, elapsedMs: Math.round(performance.now() - start), networkError: clean(error.cause?.code ?? error.name ?? 'network_error') }; }
}
try {
  const { REMOTE_DATASETS, upstreamUrl, parseTimeSeriesText } = await server.ssrLoadModule('/src/core/data/remote.ts');
  const { GET } = await server.ssrLoadModule('/api/giovanni.ts');
  const { capitalByCode } = await server.ssrLoadModule('/src/core/geo/capitals.ts');
  const product = REMOTE_DATASETS.SOIL_MOISTURE.products[0];
  report.candidate.product = product.id;
  report.candidate.scale = product.scale;
  report.plannedCapitals = ['TH', 'EG', 'NO'].map((code) => capitalByCode(code));
  const catalog = await request('https://api.giovanni.earthdata.nasa.gov/configured-variables', false);
  let listed = false;
  try { listed = JSON.parse(catalog.text).configured_variables.includes(product.id); } catch { /* A failed fetch is not catalog verification. */ }
  note({ check: 'live-catalog', httpStatus: catalog.httpStatus, elapsedMs: catalog.elapsedMs, productListed: listed, networkError: catalog.networkError });
  if (!token) note({ check: 'authenticated-access', status: 'NOT_RUN', reason: 'EARTHDATA_TOKEN is not configured' });
  else {
    const point = capitalByCode('TH');
    const url = upstreamUrl(product.id, point.lat, point.lon, 2023, 2023);
    const direct = await request(url);
    const { text, ...details } = direct;
    const series = direct.httpStatus === 200 ? parseTimeSeriesText(text, product.scale) : [];
    const finite = series.filter((p) => p.value !== null);
    const unitLine = text?.split(/\r?\n/).find((line) => /^units?\s*,/i.test(line));
    const unitVerified = Boolean(unitLine && /kg\s*(?:\/\s*m(?:\^?2|²)|m(?:\^?-?2|⁻²))/i.test(unitLine));
    const valid = series.length === 12 && series.every((p) => /^2023-(0[1-9]|1[0-2])$/.test(p.t) && p.value !== null && p.value >= 0 && p.value <= 100) && unitVerified;
    note({ check: 'direct-Bangkok-2023', requestUrl: url, ...details, parsedMonths: series.length, validMonths: finite.length, unitVerified, status: valid ? 'PASS' : 'FAIL' });
    if (valid) {
      await mkdir(rawDirectory, { recursive: true });
      await writeFile(path.join(rawDirectory, 'TH-2023.csv'), clean(text));
      const days = (t) => new Date(Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5)), 0)).getUTCDate();
      report.shortYearSummary = { average: series.reduce((s, p) => s + p.value * days(p.t), 0) / 365, minimum: Math.min(...finite.map((p) => p.value)), maximum: Math.max(...finite.map((p) => p.value)), unit: 'kg/m²' };
    }
    const control = await request(url, false);
    note({ check: 'unauthenticated-control', httpStatus: control.httpStatus, elapsedMs: control.elapsedMs, errorBody: control.errorBody, networkError: control.networkError });
    // Exercise the actual handler without a local HTTP server. It requests 2001–2024.
    const start = performance.now();
    const response = await GET(new Request(`http://localhost/api/giovanni?variable=SOIL_MOISTURE&lat=${point.lat}&lon=${point.lon}`));
    const payload = await response.json();
    const samePoint = payload.lat === point.lat && payload.lon === point.lon;
    const values = Array.isArray(payload.series) ? payload.series : [];
    const complete = values.length === 288 && values.every((p, i) => p.t === `${2001 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}` && Number.isFinite(p.value) && p.value >= 0 && p.value <= 100);
    note({ check: 'existing-workbench-handler-2001-2024', httpStatus: response.status, elapsedMs: Math.round(performance.now() - start), product: payload.product, samePoint: response.ok ? samePoint : null, parsedMonths: values.length, validMonths: values.filter((p) => p.value !== null && Number.isFinite(p.value)).length, error: payload.error ? clean(payload.error) : undefined, detail: payload.detail ? clean(payload.detail).slice(0, 300) : undefined, status: response.ok && complete && samePoint && payload.product === product.id ? 'PASS' : 'FAIL' });
    // Expand only after the small numerical request succeeds; do not hammer a failing access path.
    if (valid) for (const code of ['EG', 'NO']) {
      const capital = capitalByCode(code);
      const result = await request(upstreamUrl(product.id, capital.lat, capital.lon, 2001, 2024));
      const months = result.httpStatus === 200 ? parseTimeSeriesText(result.text, product.scale) : [];
      const available = months.filter((p) => p.value !== null).length;
      const complete = months.length === 288 && months.every((p, i) => p.t === `${2001 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}` && p.value !== null && p.value >= 0 && p.value <= 100);
      const unitLine = result.text?.split(/\r?\n/).find((line) => /^units?\s*,/i.test(line));
      const unitVerified = Boolean(unitLine && /kg\s*(?:\/\s*m(?:\^?2|²)|m(?:\^?-?2|⁻²))/i.test(unitLine));
      note({ check: `direct-${code}-2001-2024`, httpStatus: result.httpStatus, elapsedMs: result.elapsedMs, validMonths: available, unitVerified, status: complete && unitVerified ? 'PASS' : 'FAIL', errorBody: result.errorBody, networkError: result.networkError });
      if (result.httpStatus === 200) await writeFile(path.join(rawDirectory, `${code}-2001-2024.csv`), clean(result.text));
    }
  }
  report.status = report.checks.some((c) => c.status === 'FAIL' || c.status === 'NOT_RUN') || !listed ? 'BLOCKED' : 'PASS';
  report.nextGate = report.status === 'PASS' ? 'Review source metadata and model limitations before integration.' : 'A successful numeric response with the intended server credential is required before enabling this source. No alternate credential or synthetic data was substituted.';
} finally {
  await server.close();
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${output}`);
}
if (report.status !== 'PASS') process.exitCode = 1;
