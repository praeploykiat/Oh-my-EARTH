// Derive published summaries using the exact production TypeScript aggregation and trend engine.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
const [inputFile, directory] = process.argv.slice(2);
if (!inputFile || !directory) throw new Error('Usage: node scripts/build-cache-summaries.mjs INPUT OUTPUT');
const input = JSON.parse(await readFile(inputFile, 'utf8'));
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { yearSummary, mapAnalysis } = await server.ssrLoadModule('/src/features/global/mapData.ts');
  const { analyzeGlobalTrend, GLOBAL_TREND_METHOD, BOOTSTRAP_REPLICATES, BOOTSTRAP_SEED } = await server.ssrLoadModule('/src/core/stats/globalTrend.ts');
  const maps = {};
  const save = async (file, data) => {
    const full = path.join(directory, file); await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, JSON.stringify(data, (_key, value) => { if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite map summary'); return value; }));
  };
  for (const variable of ['T2M','PRECTOTCORR','RH2M','ALLSKY_SFC_SW_DWN','NDVI']) {
    const records = Object.entries(input.capitals).filter(([,c]) => c.variables[variable]).map(([code,c]) => {
      const v=c.variables[variable];
      return [code, { ...c, source:v.source, retrievedAt:v.retrievedAt, responseCoordinates:v.responseCoordinates, requestUrl:v.sourceUrl, sources:v.sources, raw:null,
        variables:{[variable]:{series:v.values.map((value,i)=>({t:`${2001+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`,value})),sourceUnit:v.unit,missing:v.missing,rejected:v.rejected}} }];
    });
    if (!records.length) continue;
    maps[variable]={annual:{},trend:{}};
    for (let year=2001;year<=2024;year++) {
      const values={};
      for (const [code,record] of records) {
        values[code]={};
        for (const mode of ['average','lowest','highest']) {
          const result=yearSummary(record,variable,year,mode);
          values[code][mode]={value:result.value,...(result.months.length?{months:result.months}:{})};
        }
      }
      const file=`maps/${variable}/annual-${year}.json`;
      await save(file,{schemaVersion:1,releaseId:input.releaseId,variable,kind:'annual',year,records:values});
      maps[variable].annual[year]=file;
    }
    for (const basis of variable==='PRECTOTCORR'?['monthly','annual']:['monthly']) {
      const values={};
      for (const [code,record] of records) {
        const analysis=mapAnalysis(record,variable,{start:2001,end:2024},basis);
        if (!analysis.eligible) { values[code]={value:null}; continue; }
        try {
          const trend=analyzeGlobalTrend(analysis.analysisSeries.map((p)=>p.value),analysis.annualRain?1:12);
          values[code]={value:trend.slopePerDecade,evidence:trend.evidence,lower:trend.lowerPerDecade,upper:trend.upperPerDecade};
        } catch { values[code]={value:null,failed:true}; }
      }
      const file=`maps/${variable}/trend-${basis}.json`;
      await save(file,{schemaVersion:1,releaseId:input.releaseId,variable,kind:'trend',range:{start:2001,end:2024},basis,
        method:GLOBAL_TREND_METHOD,replicates:BOOTSTRAP_REPLICATES,seed:BOOTSTRAP_SEED,records:values});
      maps[variable].trend[basis]=file;
    }
    console.log(`Prepared ${variable} maps for ${records.length} capitals`);
  }
  await save('map-index.json',{maps,method:GLOBAL_TREND_METHOD,replicates:BOOTSTRAP_REPLICATES,seed:BOOTSTRAP_SEED});
} finally { await server.close(); }
