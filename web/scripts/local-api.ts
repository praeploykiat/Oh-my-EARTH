import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { loadEnv, type Plugin } from 'vite';

// Explicit routes only: query strings must never become module IDs or file paths.
const ROUTES: Record<string, string> = {
  '/api/giovanni': '/api/giovanni.ts',
  '/api/flood': '/api/flood.ts',
  '/api/questions': '/api/questions.ts',
};
const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
type Handler = (request: Request) => Response | Promise<Response>;
type ApiModule = Record<string, unknown>;

export function localApiMiddleware(load: (id: string) => Promise<ApiModule>, logError: (message: string) => void) {
  return async (incoming: IncomingMessage, outgoing: ServerResponse, next: () => void): Promise<void> => {
    const url = new URL(incoming.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) { next(); return; }
    const json = (status: number, error: string) => {
      outgoing.statusCode = status;
      outgoing.setHeader('content-type', 'application/json');
      outgoing.setHeader('cache-control', 'no-store');
      outgoing.end(JSON.stringify({ error }));
    };
    const moduleId = ROUTES[url.pathname];
    if (!moduleId) { json(404, 'Unknown API route'); return; }
    try {
      const module = await load(moduleId);
      const method = incoming.method ?? 'GET';
      const handler = module[method];
      if (!METHODS.includes(method) || typeof handler !== 'function') {
        outgoing.setHeader('allow', METHODS.filter((name) => typeof module[name] === 'function').join(', '));
        json(405, 'Method not allowed');
        return;
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
        else if (value !== undefined) headers.set(name, value);
      }
      const init: RequestInit & { duplex?: 'half' } = { method, headers };
      if (method !== 'GET' && method !== 'HEAD') {
        init.body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
        init.duplex = 'half';
      }
      const response = await (handler as Handler)(new Request(url, init));
      outgoing.statusCode = response.status;
      response.headers.forEach((value, name) => outgoing.setHeader(name, value));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      // Never return stack traces, environment values or upstream credentials.
      logError(`Local API handler failed: ${url.pathname}`);
      json(500, 'Local API handler failed; check the server configuration');
    }
  };
}

export function localApi(): Plugin {
  return {
    name: 'local-api-handlers',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, '');
      const keys = ['EARTHDATA_TOKEN', 'SPHERE_KEY', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
      for (const key of keys) {
        if (process.env[key] === undefined && env[key] !== undefined) process.env[key] = env[key];
      }
      server.middlewares.use(localApiMiddleware(
        (id) => server.ssrLoadModule(id),
        (message) => server.config.logger.error(message),
      ));
    },
  };
}
