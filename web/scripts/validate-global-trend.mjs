import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { analyzeGlobalTrend } = await server.ssrLoadModule('/src/core/stats/globalTrend.ts');
  const fixture = JSON.parse(await readFile('../fixtures/global-trend-cases.json', 'utf8'));
  const tolerance = 1e-8;
  const report = {
    method: fixture.method, tolerance, replicates: fixture.replicates,
    reference: { python: fixture.python, numpy: fixture.numpy, scipy: fixture.scipy },
    scope: 'Numerical parity with an independently implemented NumPy/SciPy reference. Not a guarantee of statistical coverage or correctness for every environmental process.',
    cases: [],
  };
  for (const testCase of fixture.cases) {
    const actual = analyzeGlobalTrend(testCase.values, testCase.period);
    let maximumAbsoluteDifference = 0;
    const mismatches = [];
    function compare(result, expected, field = '') {
      if (typeof expected === 'number') {
        const difference = Math.abs(result - expected);
        maximumAbsoluteDifference = Math.max(maximumAbsoluteDifference, difference);
        if (!Number.isFinite(difference) || difference > tolerance) mismatches.push(field);
      } else if (expected !== null && typeof expected === 'object') {
        if (Array.isArray(expected) && (!Array.isArray(result) || result.length !== expected.length)) { mismatches.push(field); return; }
        for (const [key, value] of Object.entries(expected)) compare(result?.[key], value, `${field}.${key}`);
      } else if (result !== expected) mismatches.push(field);
    }
    compare(actual, testCase.expected);
    report.cases.push({ name: testCase.name, passed: !mismatches.length, maximumAbsoluteDifference, mismatches });
  }
  report.passed = report.cases.every((testCase) => testCase.passed);
  const output = path.resolve('../docs/global-trend-validation.json');
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.cases.filter((testCase) => testCase.passed).length}/${report.cases.length} reference cases passed; tolerance ${tolerance}`);
  console.log(output);
  if (!report.passed) process.exitCode = 1;
} finally { await server.close(); }
