// Prepare descriptive slopes only, using cached monthly data; never contacts NASA.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const [releaseId,refPath]=process.argv.slice(2);
if(!/^[a-f0-9]{64}$/.test(releaseId)||!refPath)throw new Error('Expected source release and reference output');
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
  const {co2Trend}=await server.ssrLoadModule('/src/features/global/co2Trend.ts');
  const {CAPITALS}=await server.ssrLoadModule('/src/core/geo/capitals.ts');
  const records={};
  for(const capital of CAPITALS){
    const r=JSON.parse(await readFile(resolve('public/co2-cache/releases',releaseId,'capitals',capital.code+'.json'),'utf8'));
    const value=co2Trend(r.series,{start:2015,end:2021});
    if(value===null)throw new Error('Incomplete CO2 descriptive trend');
    records[capital.code]={value,evidence:'limited',descriptive:true};
  }
  const data=JSON.stringify({sourceReleaseId:releaseId,method:'descriptive-seasonal-sen-v1',range:{start:2015,end:2021},unit:'ppm/decade',records});
  const sha256=createHash('sha256').update(data).digest('hex'),path=`trends/${sha256}.json`;
  await mkdir('public/co2-cache/trends',{recursive:true});
  await writeFile(resolve('public/co2-cache',path),data);
  await writeFile(refPath,JSON.stringify({path,sha256}));
}finally{await server.close();}
