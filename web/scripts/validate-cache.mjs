// Validate every database-published artifact with the same reader used by the explorer.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import { createServer } from 'vite';
const root=resolve('public/explorer-cache');
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
const original=globalThis.fetch;
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
let requests=0;
globalThis.fetch=async (url)=>{
  if(typeof url!=='string' || !url.startsWith('/explorer-cache/') || url.includes('..'))throw new Error('Unexpected cache URL');
  requests++;
  return new Response(new Uint8Array(await readFile(resolve(root,url.slice('/explorer-cache/'.length)))));
};
try {
  const cache=await server.ssrLoadModule('/src/features/global/publishedCache.ts');
  const {capitalByCode}=await server.ssrLoadModule('/src/core/geo/capitals.ts');
  const m=await cache.publishedManifest();
  for(const [variable,codes] of Object.entries(m.available)) {
    for(const code of codes)await cache.loadPublishedRecord(capitalByCode(code),variable);
    for(const year of Object.keys(m.maps[variable].annual))
      for(const mode of ['average','lowest','highest'])await cache.loadPublishedMap(variable,mode,Number(year),false);
    for(const basis of Object.keys(m.maps[variable].trend))await cache.loadPublishedMap(variable,'trend',2024,basis==='annual');
  }
  console.log(JSON.stringify({releaseId:m.releaseId,capitals:Object.keys(m.capitals).length,available:m.available && Object.fromEntries(Object.entries(m.available).map(([v,c])=>[v,c.length])),validatedFiles:requests-1}));
} finally {globalThis.fetch=original;await server.close();}
