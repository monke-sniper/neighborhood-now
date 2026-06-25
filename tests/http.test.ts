import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { httpJson, httpText, HttpError } from '@/lib/http';
import { UpstreamError } from '@/lib/errors';

function mockFetch(status: number, body: unknown, contentType = 'application/json') {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => body,
    headers: new Headers({ 'content-type': contentType }),
  })) as unknown as typeof fetch;
}

describe('httpJson', () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns parsed JSON on 2xx', async () => {
    global.fetch = mockFetch(200, { ok: true }) as typeof fetch;
    const r = await httpJson<{ ok: boolean }>('https://x.test/y', {
      source: 'nominatim',
    });
    expect(r).toEqual({ ok: true });
  });

  it('throws UpstreamError on non-2xx with status', async () => {
    global.fetch = mockFetch(404, { error: 'missing' }) as typeof fetch;
    await expect(
      httpJson('https://x.test/y', { source: 'builddata' }),
    ).rejects.toBeInstanceOf(UpstreamError);
    try {
      global.fetch = mockFetch(503, 'service unavailable', 'text/plain') as typeof fetch;
      await httpJson('https://x.test/y', { source: 'weather' });
    } catch (e) {
      expect(e).toBeInstanceOf(UpstreamError);
      const ue = e as UpstreamError;
      expect(ue.status).toBe(503);
      expect(ue.source).toBe('weather');
    }
  });

  it('passes through the configured source on error', async () => {
    global.fetch = mockFetch(401, { error: 'unauth' }) as typeof fetch;
    await expect(
      httpJson('https://x.test/y', { source: 'ollama' }),
    ).rejects.toMatchObject({ source: 'ollama', status: 401 });
  });

  it('serializes body as JSON when provided', async () => {
    const fn = mockFetch(200, { echo: 1 }) as unknown as typeof fetch;
    global.fetch = fn;
    await httpJson('https://x.test/y', {
      source: 'ollama',
      method: 'POST',
      body: { q: 'hi' },
    });
    expect(fn).toHaveBeenCalled();
    const init = (fn as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ q: 'hi' });
  });
});

describe('httpText', () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns text body on 2xx', async () => {
    global.fetch = mockFetch(200, 'plain text', 'text/plain') as typeof fetch;
    const r = await httpText('https://x.test/y', { source: 'nominatim' });
    expect(r).toBe('plain text');
  });

  it('throws UpstreamError on non-2xx', async () => {
    global.fetch = mockFetch(500, 'crash', 'text/plain') as typeof fetch;
    await expect(
      httpText('https://x.test/y', { source: 'weather' }),
    ).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe('HttpError', () => {
  it('includes status, source, and body in message', () => {
    const e = new HttpError('builddata', 502, 'bad gateway');
    expect(e.status).toBe(502);
    expect(e.source).toBe('builddata');
    expect(e.body).toBe('bad gateway');
    expect(e.message).toContain('builddata');
    expect(e.message).toContain('502');
  });
});
