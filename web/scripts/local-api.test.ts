import { PassThrough } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { localApiMiddleware } from './local-api';

function exchange(url: string, method = 'GET', body?: string) {
  const request = new PassThrough() as unknown as IncomingMessage;
  request.url = url;
  request.method = method;
  request.headers = { 'content-type': 'application/json' };
  if (body !== undefined) (request as unknown as PassThrough).end(body);
  const headers = new Map<string, string>();
  let output = '';
  let complete: () => void = () => undefined;
  const ended = new Promise<void>((resolve) => { complete = resolve; });
  const response = {
    statusCode: 200,
    setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value); },
    end(value: string | Buffer) { output = String(value); complete(); },
  } as unknown as ServerResponse;
  return { request, response, headers, ended, text: () => output };
}

describe('local API request routing', () => {
  it('strips coordinate queries before loading the Giovanni TypeScript module', async () => {
    const load = vi.fn().mockResolvedValue({ GET: (request: Request) => Response.json({ lon: new URL(request.url).searchParams.get('lon') }) });
    const next = vi.fn();
    const io = exchange('/api/giovanni?variable=AOD&lat=13.7500&lon=100.2000');
    await localApiMiddleware(load, vi.fn())(io.request, io.response, next);
    expect(load).toHaveBeenCalledWith('/api/giovanni.ts');
    expect(io.response.statusCode).toBe(200);
    expect(JSON.parse(io.text())).toEqual({ lon: '100.2000' });
    expect(next).not.toHaveBeenCalled();
  });
  it('forwards JSON bodies and response status/headers for game API methods', async () => {
    const load = vi.fn().mockResolvedValue({ PUT: async (request: Request) => Response.json(await request.json(), { status: 409, headers: { 'cache-control': 'no-store' } }) });
    const io = exchange('/api/questions', 'PUT', '{"baseVersion":"old-version"}');
    await localApiMiddleware(load, vi.fn())(io.request, io.response, vi.fn());
    expect(io.response.statusCode).toBe(409);
    expect(io.headers.get('cache-control')).toBe('no-store');
    expect(JSON.parse(io.text())).toEqual({ baseVersion: 'old-version' });
  });
  it('passes frontend requests through and blocks unknown/source API paths', async () => {
    const load = vi.fn();
    const next = vi.fn();
    const page = exchange('/src/App.tsx');
    await localApiMiddleware(load, vi.fn())(page.request, page.response, next);
    expect(next).toHaveBeenCalledOnce();
    for (const path of ['/api/unknown', '/api/giovanni.ts?lon=100.2000', '/api/_proxy.ts']) {
      const io = exchange(path);
      await localApiMiddleware(load, vi.fn())(io.request, io.response, vi.fn());
      expect(io.response.statusCode).toBe(404);
      expect(io.headers.get('content-type')).toBe('application/json');
    }
    expect(load).not.toHaveBeenCalled();
  });
  it('returns method errors as JSON and keeps server exceptions out of responses', async () => {
    const io = exchange('/api/flood', 'POST', '{}');
    await localApiMiddleware(async () => ({ GET: vi.fn() }), vi.fn())(io.request, io.response, vi.fn());
    expect(io.response.statusCode).toBe(405);
    expect(io.headers.get('allow')).toBe('GET');
    const error = exchange('/api/giovanni?lon=100.2000');
    await localApiMiddleware(async () => { throw new Error('private-config-value'); }, vi.fn())(error.request, error.response, vi.fn());
    expect(error.response.statusCode).toBe(500);
    expect(error.text()).not.toContain('private-config-value');
  });
});

describe('real Vite middleware with existing API handlers', () => {
  let server: ViteDevServer;
  beforeAll(async () => {
    server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  });
  afterAll(async () => { await server?.close(); });
  it.each([
    ['/api/giovanni?variable=INVALID&lat=13.7500&lon=100.2000', 'GET', undefined, 400],
    ['/api/giovanni?variable=AOD&lat=130.7500&lon=100.2000', 'GET', undefined, 400],
    ['/api/flood?lat=0.0000&lon=100.2000', 'GET', undefined, 400],
    ['/api/questions', 'POST', '{}', 400],
    ['/api/questions', 'PUT', '{}', 400],
    ['/api/questions?id=bad.id', 'DELETE', undefined, 400],
  ])('executes %s as an API response without external calls', async (url, method, body, status) => {
    const io = exchange(url, method, body);
    server.middlewares(io.request, io.response, () => { throw new Error('API route escaped into Vite transforms'); });
    await io.ended;
    expect(io.response.statusCode).toBe(status);
    expect(io.headers.get('content-type')).toContain('application/json');
    expect(JSON.parse(io.text())).toHaveProperty('error');
    expect(io.text()).not.toContain('Invalid loader');
  });
});
