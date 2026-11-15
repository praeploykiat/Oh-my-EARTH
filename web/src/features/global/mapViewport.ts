export interface MapViewport {zoom:number;x:number;y:number}
export const WORLD_VIEW:MapViewport={zoom:1,x:0,y:0};
export function boundView(view:MapViewport):MapViewport{
  const zoom=Math.max(1,Math.min(8,view.zoom));
  return {zoom,x:Math.max(960*(1-zoom),Math.min(0,view.x)),y:Math.max(500*(1-zoom),Math.min(0,view.y))};
}
export function zoomAt(view:MapViewport,zoom:number,x=480,y=250):MapViewport{
  const next=Math.max(1,Math.min(8,zoom)),ratio=next/view.zoom;
  return boundView({zoom:next,x:x-(x-view.x)*ratio,y:y-(y-view.y)*ratio});
}
