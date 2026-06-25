import { UpstreamError, type UpstreamSource } from './errors';

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: HeadersInit;
  body?: unknown;
  source: UpstreamSource;
  timeoutMs?: number;
  cache?: RequestCache;
}

export class HttpError extends Error {
  readonly status: number;
  readonly source: UpstreamSource;
  readonly body: string;
  constructor(source: UpstreamSource, status: number, body: string) {
    super(`[${source}] HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = 'HttpError';
    this.source = source;
    this.status = status;
    this.body = body;
  }
}

export async function httpJson<TRes>(
  url: string,
  opts: HttpRequestOptions,
): Promise<TRes> {
  const method = opts.method ?? 'GET';
  const headers = new Headers(opts.headers);
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }
  const init: RequestInit = {
    method,
    headers,
    cache: opts.cache ?? 'no-store',
  };
  if (body !== undefined) init.body = body;

  const ctrl = new AbortController();
  const timer = opts.timeoutMs
    ? setTimeout(() => ctrl.abort(), opts.timeoutMs)
    : null;
  init.signal = ctrl.signal;
  try {
    const res = await fetch(url, init);
    if (timer) clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpError(opts.source, res.status, text);
    }
    return (await res.json()) as TRes;
  } catch (e) {
    if (timer) clearTimeout(timer);
    if (e instanceof HttpError) {
      throw new UpstreamError(opts.source, e.message, { status: e.status, cause: e });
    }
    if (e instanceof UpstreamError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new UpstreamError(opts.source, msg, { cause: e });
  }
}

export async function httpText(
  url: string,
  opts: HttpRequestOptions,
): Promise<string> {
  const method = opts.method ?? 'GET';
  const headers = new Headers(opts.headers);
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  }
  const init: RequestInit = {
    method,
    headers,
    cache: opts.cache ?? 'no-store',
  };
  if (body !== undefined) init.body = body;

  const ctrl = new AbortController();
  const timer = opts.timeoutMs
    ? setTimeout(() => ctrl.abort(), opts.timeoutMs)
    : null;
  init.signal = ctrl.signal;
  try {
    const res = await fetch(url, init);
    if (timer) clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpError(opts.source, res.status, text);
    }
    return await res.text();
  } catch (e) {
    if (timer) clearTimeout(timer);
    if (e instanceof HttpError) {
      throw new UpstreamError(opts.source, e.message, { status: e.status, cause: e });
    }
    if (e instanceof UpstreamError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new UpstreamError(opts.source, msg, { cause: e });
  }
}
