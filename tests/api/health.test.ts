import { describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    readdirSync: vi.fn(() => ['a.json', 'b.json', 'c.json', 'README.md']),
    existsSync: vi.fn(() => true),
  };
});

import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns ok with uptime, build sha, and corpus count', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.service).toBe('neighborhood-now');
    expect(typeof body.uptimeMs).toBe('number');
    expect((body.uptimeMs as number) >= 0).toBe(true);
    expect(typeof body.buildSha).toBe('string');
    expect(typeof body.now).toBe('string');
    expect(typeof body.corpusCount).toBe('number');
  });

  it('sets no-store cache header', async () => {
    const res = await GET();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
