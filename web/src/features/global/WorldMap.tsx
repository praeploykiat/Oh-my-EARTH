import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import { useAsync } from '../../core/data';
import { CAPITALS, type Capital } from '../../core/geo/capitals';
import { useI18n } from '../../core/i18n';

import { mapColor, supported, type MapMode, type MapValue } from './mapData';

import { WORLD_VIEW, boundView, zoomAt } from './mapViewport';

type World = FeatureCollection<Geometry, { iso3: string; name: string }>;
let world: Promise<World> | undefined;
function loadWorld(): Promise<World> {
  world ??= fetch(`${import.meta.env.BASE_URL}geo/world-countries.json`).then((response) => {
    if (!response.ok) throw new Error('World map unavailable');
    return response.json() as Promise<World>;
  }).catch((error: unknown) => { world = undefined; throw error; });
  return world;
}

export function WorldMap({ selected, onSelect, values, mode, domain, unit, errors, period, unavailable = [] }: { unavailable?: string[]; period: string; selected: Capital; onSelect: (code: string) => void; values: Record<string, MapValue>; mode: MapMode; domain: [number, number]; unit: string; errors: Record<string, boolean> }) {
  const { t, language } = useI18n();
  const [camera,setCamera]=useState(WORLD_VIEW);
  const {zoom,x:tx,y:ty}=camera;
  const svg=useRef<SVGSVGElement>(null);
  const pointers=useRef(new Map<number,{x:number;y:number}>());
  const origin=useRef({x:0,y:0});
  const moved=useRef(false);
  function point(clientX:number,clientY:number){
    const matrix=svg.current?.getScreenCTM();
    return matrix?new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse()):{x:0,y:0};
  }
  function pointerDown(event:ReactPointerEvent<SVGSVGElement>){
    if(event.pointerType==='mouse'&&event.button!==0)return;
    const p=point(event.clientX,event.clientY);
    if(!pointers.current.size){moved.current=false;origin.current=p;}
    pointers.current.set(event.pointerId,p);
  }
  function pointerMove(event:ReactPointerEvent<SVGSVGElement>){
    const previous=pointers.current.get(event.pointerId);if(!previous)return;
    const before=[...pointers.current.values()];const p=point(event.clientX,event.clientY);
    pointers.current.set(event.pointerId,p);
    if(Math.hypot(p.x-origin.current.x,p.y-origin.current.y)>4||pointers.current.size>1)moved.current=true;
    if(!moved.current)return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if(before.length===2){
      const after=[...pointers.current.values()];
      const center=(a:typeof after)=>({x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2});
      const a=center(before),b=center(after);
      const distance=(a:typeof after)=>Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
      const ratio=distance(before)>0?distance(after)/distance(before):1;
      setCamera(v=>{const z=zoomAt(v,v.zoom*ratio,a.x,a.y);return boundView({...z,x:z.x+b.x-a.x,y:z.y+b.y-a.y});});
    }else setCamera(v=>boundView({...v,x:v.x+p.x-previous.x,y:v.y+p.y-previous.y}));
  }
  function pointerUp(event:ReactPointerEvent<SVGSVGElement>){
    pointers.current.delete(event.pointerId);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const [attempt, setAttempt] = useState(0);
  const boundaries = useAsync(loadWorld, [attempt]);
  useEffect(()=>{
    const element=svg.current;if(!element)return;
    const wheel=(event:WheelEvent)=>{
      event.preventDefault();const p=point(event.clientX,event.clientY);
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?500:1);
      setCamera(v=>zoomAt(v,v.zoom*Math.exp(-delta*.002),p.x,p.y));
    };
    element.addEventListener('wheel',wheel,{passive:false});
    return()=>element.removeEventListener('wheel',wheel);
  },[attempt,boundaries.status]);

  const { projection, path } = useMemo(() => {
    const projection = geoNaturalEarth1().fitExtent([[12, 12], [948, 488]], { type: 'Sphere' });
    return { projection, path: geoPath(projection) };
  }, []);
  const [cx, cy] = projection([selected.lon, selected.lat])!;


  return (
    <div className="global-map">
      <div className="global-map-toolbar">
        <span id="global-map-help">{t('global.mapNavigation')}</span>
        <div>
          <button type="button" aria-label={t('global.zoomOut')} disabled={zoom <= 1} onClick={() => setCamera(v=>zoomAt(v,v.zoom/1.5))}>−</button>
          <button type="button" aria-label={t('global.zoomIn')} disabled={zoom >= 8} onClick={() => setCamera(v=>zoomAt(v,v.zoom*1.5))}>+</button>
          <button type="button" onClick={() => setCamera(WORLD_VIEW)}>{t('global.reset')}</button>
        </div>
      </div>
      {boundaries.status === 'error' ? <div role="alert" className="global-map-error">{t('global.mapFailed')} <button type="button" onClick={() => setAttempt((n) => n + 1)}>{t('state.retry')}</button></div> : (
        <svg ref={svg} viewBox="0 0 960 500" role="group" tabIndex={0} aria-label={t('global.mapLabel')} aria-describedby="global-map-help"
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
          onLostPointerCapture={event=>pointers.current.delete(event.pointerId)}
          onClickCapture={event=>{if(moved.current){event.preventDefault();event.stopPropagation();}}}
          onDoubleClick={event=>{event.preventDefault();const p=point(event.clientX,event.clientY);setCamera(v=>zoomAt(v,v.zoom*1.5,p.x,p.y));}}
          onKeyDown={event=>{
            if(event.target!==event.currentTarget)return;
            const shifts:Record<string,[number,number]>={ArrowLeft:[70,0],ArrowRight:[-70,0],ArrowUp:[0,70],ArrowDown:[0,-70]};
            if(shifts[event.key]){event.preventDefault();const [x,y]=shifts[event.key];setCamera(v=>boundView({...v,x:v.x+x,y:v.y+y}));}
            else if(['+','=','-','Home'].includes(event.key)){event.preventDefault();setCamera(v=>event.key==='Home'?WORLD_VIEW:zoomAt(v,v.zoom*(event.key==='-'?1/1.5:1.5)));}
          }}>
          <defs><clipPath id="global-map-clip"><rect width="960" height="500" /></clipPath></defs>
          <g clipPath="url(#global-map-clip)">
            <g transform={`translate(${tx},${ty}) scale(${zoom})`}>
              <path d={path({ type: 'Sphere' }) ?? ''} className="global-ocean" />
              <path d={path(geoGraticule10()) ?? ''} className="global-graticule" />
              {boundaries.status === 'ready' && boundaries.data.features.map((feature, index) => {
                const capital = CAPITALS.find((c) => c.iso3 === feature.properties.iso3);
                return <path key={`${feature.properties.iso3}-${index}`} d={path(feature) ?? ''}
                  className={`global-country ${capital?.code === selected.code ? 'is-selected' : ''}`}
                  onClick={() => capital && onSelect(capital.code)}>
                  <title>{feature.properties.name}</title>
                </path>;
              })}
              <circle cx={cx} cy={cy} r={10 / Math.sqrt(zoom)} className="global-capital-halo" />
              {[...CAPITALS.filter((c) => c.code !== selected.code), selected].map((capital) => {
                const [x, y] = projection([capital.lon, capital.lat])!;
                const entry = values[capital.code];
                const value = entry?.value;
                const ready = typeof value === 'number';
                const uncertain = ready && mode === 'trend' && !supported(entry);
                const color = ready ? mapColor(value, domain, mode) : '#82938f';
                const status = ready ? `${value.toFixed(3)} ${unit}${mode === 'trend' && entry.descriptive ? ` / ${t('global.map.decade')} · ${period} · ${t('global.co2.noInference')}` : mode === 'trend' ? ` / ${t('global.map.decade')} · ${period} · ${t(`global.trend.${entry.evidence}`)} · ${t('global.map.interval')}: ${entry.lower?.toFixed(3)} to ${entry.upper?.toFixed(3)} ${unit} / ${t('global.map.decade')}` : ` · ${period}${entry.months?.length ? ` · ${entry.months.map((month) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString(language === 'th' ? 'th-TH-u-ca-gregory' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })).join(', ')}` : ''}`}`
                  : unavailable.includes(capital.code) ? t('cache.unavailablePoint') : t(errors[capital.code] || entry?.failed ? 'global.map.failed' : entry ? 'global.map.insufficient' : 'global.map.pending');
                return <circle key={capital.code} cx={x} cy={y} r={(capital.code === selected.code ? 5 : 3.5) / Math.sqrt(zoom)}
                  className="global-capital global-colored-capital" style={{ fill: uncertain || !ready ? '#152b30' : color, stroke: color, strokeWidth: uncertain ? 2 : 1, strokeDasharray: !ready ? '2 1' : undefined }}
                  role="button" tabIndex={0} aria-label={`${capital.country} · ${capital.city}: ${status}`}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(capital.code); } }}
                  onClick={() => onSelect(capital.code)}><title>{capital.country} · {capital.city}: {status}</title></circle>;
              })}
            </g>
          </g>
        </svg>
      )}
      {boundaries.status === 'loading' && <span className="global-map-loading" role="status">{t('status.loading')}</span>}
      <div className="global-map-caption"><span><i /> {t('global.capitalMarker')}</span><strong>{selected.city} · {selected.lat.toFixed(4)}, {selected.lon.toFixed(4)}</strong></div>
    </div>
  );
}
