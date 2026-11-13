import { proxy } from './_proxy';

export const maxDuration = 60;

export function GET(request: Request): Promise<Response> {
  return proxy(request, 'giovanni');
}
