// Opt-in live pilot: uses the same validators and aggregators as the explorer.
// Run from web/: npm run validate:global:live -- --countries=TH,NO,EG,AU,SG
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { fetchGlobalRecord } = await server.ssrLoadModule('/src/features/global/powerRecord.ts');
  const { GLOBAL_VARIABLES, annualRecord, recordCoverage } = await server.ssrLoadModule('/src/features/global/data.ts');
  const { capitalByCode } = await server.ssrLoadModule('/src/core/geo/capitals.ts');
  const countries = (process.argv.find((arg) => arg.startsWith('--countries='))?.split('=')[1] ?? 'TH,NO,EG,AU,SG').split(',');
  if (!countries.length || countries.some((code) => !capitalByCode(code))) throw new Error('Use valid catalog country codes, e.g. --countries=TH,NO,EG,AU,SG');
  const rawDirectory = path.resolve('../pipeline/raw/global-validation');
  const reportPath = path.resolve('../docs/global-data-validation.json');
  await mkdir(rawDirectory, { recursive: true });
  await mkdir(path.dirname(reportPath), { recursive: true });
  const report = { checkedAt: new Date().toISOString(), period: { start: 2001, end: 2024 }, scope: 'Selected pilot capitals only; not validation of all 195 locations or measurement accuracy.', locations: [] };
  for (const code of countries) {
    const capital = capitalByCode(code);
    try {
      const record = await fetchGlobalRecord(capital, true);
      const rawPath = path.join(rawDirectory, `${code}.json`);
      await writeFile(rawPath, JSON.stringify({ requested: record.requested, responseCoordinates: record.responseCoordinates, requestUrl: record.requestUrl, retrievedAt: record.retrievedAt, raw: record.raw }, null, 2) + '\n');
      const variables = Object.fromEntries(GLOBAL_VARIABLES.map((key) => {
        const data = record.variables[key];
        const annual = annualRecord(data.series, key);
        return [key, {
          sourceUnit: data.sourceUnit, ...recordCoverage(data.series), missing: data.missing, rejected: data.rejected,
          completeYears: annual.filter((p) => p.value !== null).length,
          annualUnit: key === 'PRECTOTCORR' ? 'mm/year' : data.sourceUnit,
          firstAnnualValue: annual.find((p) => p.value !== null) ?? null,
        }];
      }));
      const complete = Object.values(variables).every((v) => v.valid === v.total && !v.rejected.length);
      report.locations.push({ country: code, city: capital.city, status: complete ? 'PASS' : 'PARTIAL', requested: record.requested, responseCoordinates: record.responseCoordinates, requestUrl: record.requestUrl, retrievedAt: record.retrievedAt, sources: record.sources, rawSnapshot: path.relative(path.resolve('..'), rawPath).replaceAll('\\', '/'), variables });
      console.log(`${code}: ${complete ? 'PASS' : 'PARTIAL'} (all four variable responses validated)`);
    } catch (error) {
      report.locations.push({ country: code, city: capital.city, status: 'FAIL', error: error.message });
      console.error(`${code}: FAIL (${error.message})`);
      process.exitCode = 1;
    }
    // Persist partial progress even if a later request fails or the run is interrupted.
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(`Report: ${reportPath}`);
} finally {
  await server.close();
}
