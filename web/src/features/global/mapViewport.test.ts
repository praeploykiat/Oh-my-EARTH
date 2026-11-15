import {expect,it} from 'vitest';
import {boundView,zoomAt,WORLD_VIEW} from './mapViewport';
it('keeps the zoom anchor stationary when bounds permit it',()=>{
  const next=zoomAt(WORLD_VIEW,2,300,200);
  expect(next).toEqual({zoom:2,x:-300,y:-200});
  expect(300*next.zoom+next.x).toBe(300);
  expect(200*next.zoom+next.y).toBe(200);
});
it('bounds zoom and pan so the map cannot be lost offscreen',()=>{
  expect(boundView({zoom:2,x:-9999,y:9999})).toEqual({zoom:2,x:-960,y:0});
  expect(zoomAt(WORLD_VIEW,100).zoom).toBe(8);
  expect(zoomAt({zoom:4,x:-500,y:-300},.1)).toEqual(WORLD_VIEW);
});
