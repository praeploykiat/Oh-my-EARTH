// Precompute trends on a land grid for the Hotspot map.
// Usage: npm run build:hotspots [-- --grid 5 --limit 20]
// Progress is kept in node_modules/.cache/hotspots so a stopped run continues where it left off.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { geoContains } from 'd3-geo';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const GRID = option('grid', 5);
const LIMIT = option('limit', Infinity);
const CONCURRENCY = option('concurrency', 3);
const TIMEOUT_MS = 60000;
const RETRY_WAITS = [3000, 10000, 30000, 60000];
const CACHE_DIR = path.resolve('node_modules/.cache/hotspots');
const PROGRESS = path.join(CACHE_DIR, `progress-${GRID}.json`);
const OUTPUT = path.resolve('public/data/hotspots.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value, digits = 4) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

// Land points

const world = JSON.parse(await readFile('public/geo/world-countries.json', 'utf8'));
const points = [];
for (let lat = -60 + GRID / 2; lat < 85; lat += GRID) {
  for (let lon = -180 + GRID / 2; lon < 180; lon += GRID) {
    const feature = world.features.find((f) => geoContains(f, [lon, lat]));
    if (feature) points.push({ lat, lon, iso3: feature.properties.iso3, name: feature.properties.name });
  }
}
const todo = points.slice(0, LIMIT);
console.log(`${points.length} land points on a ${GRID}° grid${todo.length < points.length ? `, running the first ${todo.length}` : ''}.`);

// Shared code from the site, loaded through Vite so TypeScript works

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { validateGlobalResponse, globalRequestUrl } = await server.ssrLoadModule('/src/features/global/powerRecord.ts');
const { mapAnalysis, mapUnit } = await server.ssrLoadModule('/src/features/global/mapData.ts');
const { GLOBAL_VARIABLES } = await server.ssrLoadModule('/src/features/global/data.ts');
const { analyzeGlobalTrend, GLOBAL_TREND_METHOD } = await server.ssrLoadModule('/src/core/stats/globalTrend.ts');
const { variableByKey } = await server.ssrLoadModule('/src/core/data/variables.ts');
const { START_YEAR, END_YEAR } = await server.ssrLoadModule('/src/core/data/range.ts');

await mkdir(CACHE_DIR, { recursive: true });
let progress = {};
try {
  progress = JSON.parse(await readFile(PROGRESS, 'utf8'));
} catch {
  progress = {};
}
const keyOf = (p) => `${p.lat},${p.lon}`;

async function fetchPoint(point) {
  const url = globalRequestUrl(point);
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) return await response.json();
      if (attempt >= RETRY_WAITS.length || (response.status < 500 && response.status !== 429)) throw new Error(`NASA POWER returned ${response.status}`);
    } catch (error) {
      if (attempt >= RETRY_WAITS.length) throw error;
    } finally {
      clearTimeout(timer);
    }
    await sleep(RETRY_WAITS[attempt]);
  }
}

const EVIDENCE = { increase: 'i', decrease: 'd', inconclusive: 'n', sensitive: 's', limited: 'l' };
const range = { start: START_YEAR, end: END_YEAR };
const units = {};

function analyse(record) {
  const result = {};
  for (const variable of GLOBAL_VARIABLES) {
    const analysis = mapAnalysis(record, variable, range, 'annual');
    units[variable] ??= mapUnit(variable, 'trend', record.variables[variable].sourceUnit, analysis.annualRain);
    if (!analysis.eligible) {
      result[variable] = null;
      continue;
    }
    const trend = analyzeGlobalTrend(analysis.analysisSeries.map((p) => p.value), analysis.annualRain ? 1 : 12);
    result[variable] = [round(trend.slopePerDecade), round(trend.lowerPerDecade), round(trend.upperPerDecade), round(trend.pValue), EVIDENCE[trend.evidence] ?? 'n'];
  }
  return result;
}

// Run

let done = 0;
let failed = 0;
let sinceSave = 0;
const queue = todo.filter((p) => !progress[keyOf(p)] || progress[keyOf(p)].error);
console.log(`${todo.length - queue.length} already done, ${queue.length} to fetch.`);
const started = Date.now();

async function save() {
  await writeFile(PROGRESS, JSON.stringify(progress));
}

async function worker() {
  while (queue.length) {
    const point = queue.shift();
    try {
      const body = await fetchPoint(point);
      const record = validateGlobalResponse(body, point, new Date().toISOString());
      progress[keyOf(point)] = { values: analyse(record) };
    } catch (error) {
      failed += 1;
      progress[keyOf(point)] = { error: error instanceof Error ? error.message : String(error) };
    }
    done += 1;
    if (++sinceSave >= 10) {
      sinceSave = 0;
      await save();
    }
    if (done % 10 === 0 || !queue.length) {
      const minutes = (Date.now() - started) / 60000;
      const left = queue.length ? Math.ceil((minutes / done) * queue.length) : 0;
      console.log(`${done} fetched (${failed} failed), about ${left} min left`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
await save();

// Units for points restored from an earlier run
for (const variable of GLOBAL_VARIABLES) {
  units[variable] ??= variable === 'PRECTOTCORR' ? 'mm/year' : variableByKey(variable).unit;
}

const output = {
  generatedAt: new Date().toISOString(),
  gridDegrees: GRID,
  start: START_YEAR,
  end: END_YEAR,
  method: GLOBAL_TREND_METHOD,
  units,
  points: todo
    .filter((p) => progress[keyOf(p)]?.values)
    .map((p) => ({ lat: p.lat, lon: p.lon, iso3: p.iso3, name: p.name, ...progress[keyOf(p)].values })),
};
await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify(output));
const missing = todo.filter((p) => !progress[keyOf(p)]?.values).length;
console.log(`Wrote ${output.points.length} points to public/data/hotspots.json.${missing ? ` ${missing} points failed; run again to retry them.` : ''}`);
await server.close();
