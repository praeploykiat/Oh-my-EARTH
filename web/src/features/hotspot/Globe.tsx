import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';
import { geoDistance, geoGraticule10, geoOrthographic, geoPath, geoInterpolate } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';

export interface GlobeDot {
  id: string;
  lon: number;
  lat: number;
  color: string;
  size: number;
  label: string;
}

interface GlobeProps {
  world: FeatureCollection<Geometry> | null;
  dots: GlobeDot[];
  selectedId: string | null;
  focus: { lon: number; lat: number; key: number } | null;
  resetKey: number;
  zoomStep: { delta: number; key: number } | null;
  label: string;
  onSelect: (id: string) => void;
}

const START: [number, number] = [-100, -15];
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const SPIN_DEG_PER_MS = 0.006 * 10;

// A rotatable, zoomable orthographic globe drawn on canvas

export function Globe({ world, dots, selectedId, focus, resetKey, zoomStep, label, onSelect }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ rotate: [...START] as [number, number], zoom: 1, spinning: true, size: { w: 0, h: 0 } });
  const props = useRef({ world, dots, selectedId });
  props.current = { world, dots, selectedId };
  const animation = useRef<number | null>(null);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = view.current.size;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const radius = (Math.min(w, h) / 2 - 18) * view.current.zoom;
    const projection = geoOrthographic().scale(radius).translate([w / 2, h / 2]).rotate(view.current.rotate).clipAngle(90);
    const path = geoPath(projection, ctx);
    const center: [number, number] = [-view.current.rotate[0], -view.current.rotate[1]];

    const glow = ctx.createRadialGradient(w / 2, h / 2, radius * 0.92, w / 2, h / 2, radius * 1.12);
    glow.addColorStop(0, 'rgba(79, 209, 165, 0.28)');
    glow.addColorStop(1, 'rgba(79, 209, 165, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, radius * 1.12, 0, Math.PI * 2);
    ctx.fill();

    const ocean = ctx.createRadialGradient(w / 2 - radius * 0.35, h / 2 - radius * 0.4, radius * 0.1, w / 2, h / 2, radius);
    ocean.addColorStop(0, '#16353a');
    ocean.addColorStop(1, '#0a1a1d');
    ctx.fillStyle = ocean;
    ctx.beginPath();
    path({ type: 'Sphere' });
    ctx.fill();

    ctx.strokeStyle = 'rgba(127, 224, 192, 0.08)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    path(geoGraticule10());
    ctx.stroke();

    const { world: map, dots: points, selectedId: chosen } = props.current;
    if (map) {
      ctx.fillStyle = '#25403b';
      ctx.strokeStyle = 'rgba(160, 200, 185, 0.35)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      path(map);
      ctx.fill();
      ctx.stroke();
    }

    const dotScale = view.current.zoom ** 0.35 * (Math.min(w, h) / 760 + 0.3);
    for (const dot of points) {
      if (geoDistance([dot.lon, dot.lat], center) > Math.PI / 2 - 0.03) continue;
      const xy = projection([dot.lon, dot.lat]);
      if (!xy) continue;
      const r = dot.size * dotScale;
      ctx.shadowColor = dot.color;
      ctx.shadowBlur = r * 1.6;
      ctx.fillStyle = dot.color;
      ctx.beginPath();
      ctx.arc(xy[0], xy[1], r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (dot.id === chosen) {
        ctx.strokeStyle = '#f4f7f6';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(xy[0], xy[1], r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = 'rgba(127, 224, 192, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    path({ type: 'Sphere' });
    ctx.stroke();
  }, []);

  // Size and spin

  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      const w = canvas.parentElement!.clientWidth;
      const h = Math.min(w, Math.max(320, window.innerHeight * 0.7));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
      view.current.size = { w, h };
      draw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement!);

    let last = performance.now();
    let frame = 0;
    const spin = (now: number) => {
      if (view.current.spinning && !reduceMotion && animation.current === null) {
        view.current.rotate[0] += (now - last) * SPIN_DEG_PER_MS;
        draw();
      }
      last = now;
      frame = requestAnimationFrame(spin);
    };
    frame = requestAnimationFrame(spin);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [draw, reduceMotion]);

  useEffect(draw, [world, dots, selectedId, draw]);

  // Smoothly turn the globe to a point

  const turnTo = useCallback(
    (target: [number, number], zoom?: number) => {
      view.current.spinning = false;
      const from: [number, number] = [-view.current.rotate[0], -view.current.rotate[1]];
      const fromZoom = view.current.zoom;
      const toZoom = zoom ?? fromZoom;
      const between = geoInterpolate(from, target);
      const start = performance.now();
      const duration = reduceMotion ? 0 : 900;
      if (animation.current !== null) cancelAnimationFrame(animation.current);
      const step = (now: number) => {
        const t = duration ? Math.min(1, (now - start) / duration) : 1;
        const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        const [lon, lat] = between(eased);
        view.current.rotate = [-lon, Math.max(-80, Math.min(80, -lat))];
        view.current.zoom = fromZoom + (toZoom - fromZoom) * eased;
        draw();
        animation.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      animation.current = requestAnimationFrame(step);
    },
    [draw, reduceMotion],
  );

  useEffect(() => {
    if (focus) turnTo([focus.lon, focus.lat], Math.max(view.current.zoom, 1.6));
  }, [focus, turnTo]);

  useEffect(() => {
    if (resetKey) turnTo([-START[0], -START[1]], 1);
  }, [resetKey, turnTo]);

  const setZoom = useCallback(
    (zoom: number) => {
      view.current.spinning = false;
      view.current.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
      draw();
    },
    [draw],
  );

  useEffect(() => {
    if (zoomStep) setZoom(view.current.zoom * zoomStep.delta);
  }, [zoomStep, setZoom]);

  // Pointer: drag to turn, pinch or wheel to zoom, click to pick a dot

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: 0, pinch: 0, zoom: 1 });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom(view.current.zoom * Math.exp(-event.deltaY * 0.0015));
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => canvas.removeEventListener('wheel', wheel);
  }, [setZoom]);

  const pick = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const box = canvas.getBoundingClientRect();
    const x = clientX - box.left;
    const y = clientY - box.top;
    const { w, h } = view.current.size;
    const projection = geoOrthographic().scale((Math.min(w, h) / 2 - 18) * view.current.zoom).translate([w / 2, h / 2]).rotate(view.current.rotate).clipAngle(90);
    const center: [number, number] = [-view.current.rotate[0], -view.current.rotate[1]];
    let best: { id: string; d: number } | null = null;
    for (const dot of props.current.dots) {
      if (geoDistance([dot.lon, dot.lat], center) > Math.PI / 2 - 0.03) continue;
      const xy = projection([dot.lon, dot.lat]);
      if (!xy) continue;
      const d = Math.hypot(xy[0] - x, xy[1] - y);
      if (d < 14 && (!best || d < best.d)) best = { id: dot.id, d };
    }
    if (best) onSelect(best.id);
  };

  return (
    <canvas
      ref={canvasRef}
      className="hotspot-globe"
      role="img"
      aria-label={label}
      tabIndex={0}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        view.current.spinning = false;
        gesture.current.moved = 0;
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          gesture.current.pinch = Math.hypot(a.x - b.x, a.y - b.y);
          gesture.current.zoom = view.current.zoom;
        }
      }}
      onPointerMove={(event) => {
        const previous = pointers.current.get(event.pointerId);
        if (!previous) return;
        const current = { x: event.clientX, y: event.clientY };
        pointers.current.set(event.pointerId, current);
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (gesture.current.pinch) setZoom(gesture.current.zoom * (distance / gesture.current.pinch));
          return;
        }
        const dx = current.x - previous.x;
        const dy = current.y - previous.y;
        gesture.current.moved += Math.abs(dx) + Math.abs(dy);
        const k = 0.3 / view.current.zoom;
        view.current.rotate = [view.current.rotate[0] + dx * k, Math.max(-80, Math.min(80, view.current.rotate[1] - dy * k))];
        draw();
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        if (pointers.current.size < 2) gesture.current.pinch = 0;
        if (gesture.current.moved < 5) pick(event.clientX, event.clientY);
      }}
      onPointerCancel={(event) => pointers.current.delete(event.pointerId)}
      onKeyDown={(event: KeyboardEvent<HTMLCanvasElement>) => {
        const turn: Record<string, [number, number]> = { ArrowLeft: [10, 0], ArrowRight: [-10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
        if (turn[event.key]) {
          event.preventDefault();
          view.current.spinning = false;
          const [dl, dp] = turn[event.key];
          view.current.rotate = [view.current.rotate[0] + dl, Math.max(-80, Math.min(80, view.current.rotate[1] + dp))];
          draw();
        }
        if (event.key === '+' || event.key === '=') setZoom(view.current.zoom * 1.4);
        if (event.key === '-') setZoom(view.current.zoom / 1.4);
      }}
    />
  );
}
