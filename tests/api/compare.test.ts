import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/nominatim', () => ({
  geocode: vi.fn(async (addr: string) => ({
    displayName: addr,
    lat: 43.647,
    lon: -79.387,
  })),
}));

vi.mock('@/lib/api/overpass', () => ({
  fetchOverpassWithFallback: vi.fn(async () => ({
    result: { amenities: [], buildings: [], transit: [], landuse: [], rawCount: 0 },
    fellBack: false,
    totalMs: 1,
  })),
}));

vi.mock('@/lib/api/builddata', () => ({
  fetchPermits: vi.fn(async () => []),
}));

vi.mock('@/lib/api/complaints', () => ({
  fetchComplaints: vi.fn(async () => []),
}));

vi.mock('@/lib/api/census', () => ({
  fetchCensus: vi.fn(async () => null),
}));

vi.mock('@/lib/api/weather', () => ({
  fetchAirQuality: vi.fn(async () => null),
}));

import { GET } from '@/app/api/compare/route';

function makeReq(url: string): Request {
  return new Request(url);
}

describe('GET /api/compare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when either address is missing', async () => {
    const r1 = await GET(makeReq('http://localhost/api/compare?a=CN+Tower'));
    expect(r1.status).toBe(400);
    const r2 = await GET(makeReq('http://localhost/api/compare?b=Liberty+Village'));
    expect(r2.status).toBe(400);
  });

  it('returns 200 for two known demo addresses in synth mode', async () => {
    const res = await GET(
      makeReq(
        'http://localhost/api/compare?a=CN+Tower,+Toronto&b=Liberty+Village,+Toronto&synth=1',
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.a).toBeDefined();
    expect(body.b).toBeDefined();
    expect(body.delta).toBeDefined();
  });

  it('returns 404 when one side has no synthetic data', async () => {
    const res = await GET(
      makeReq(
        'http://localhost/api/compare?a=CN+Tower,+Toronto&b=Not+a+real+place&synth=1',
      ),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/No synthetic data/);
  });

  it('returns 404 when both sides have no synthetic data', async () => {
    const res = await GET(
      makeReq(
        'http://localhost/api/compare?a=Not+a+real+place&b=Also+not+a+place&synth=1',
      ),
    );
    expect(res.status).toBe(404);
  });
});
