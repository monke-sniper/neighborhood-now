import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/nominatim', () => ({
  geocode: vi.fn(async (addr: string) => ({
    displayName: addr,
    lat: 43.647,
    lon: -79.387,
  })),
}));

vi.mock('@/lib/api/overpass', () => ({
  fetchOverpass: vi.fn(async () => ({
    amenities: [],
    buildings: [],
    transit: [],
    landuse: [],
    rawCount: 0,
  })),
  fetchOverpassWithFallback: vi.fn(async () => ({
    result: {
      amenities: [],
      buildings: [],
      transit: [],
      landuse: [],
      rawCount: 0,
    },
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

import { GET } from '@/app/api/report/route';

function makeReq(url: string): Request {
  return new Request(url);
}

describe('GET /api/report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when address is missing', async () => {
    const res = await GET(makeReq('http://localhost/api/report'));
    expect(res.status).toBe(400);
  });

  it('returns a report when address is provided', async () => {
    const res = await GET(
      makeReq('http://localhost/api/report?address=test'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.address).toBe('test');
    expect(typeof body.score).toBe('object');
  });

  it('returns debug info when ?debug=1 is set', async () => {
    const res = await GET(
      makeReq('http://localhost/api/report?address=test&debug=1'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.debug).toBeDefined();
    const debug = body.debug as Record<string, unknown>;
    expect(debug.geocode).toBeDefined();
    expect(debug.fetches).toBeDefined();
    expect(debug.score).toBeDefined();
  });

  it('report shape includes all expected fields', async () => {
    const res = await GET(
      makeReq('http://localhost/api/report?address=test'),
    );
    const body = (await res.json()) as Record<string, unknown>;
    for (const f of [
      'address',
      'coords',
      'fetchedAt',
      'score',
      'amenities',
      'permits',
      'complaints',
      'anomalies',
      'trends',
      'sources',
      'schoolImpacts',
    ]) {
      expect(body).toHaveProperty(f);
    }
  });

  it('radius param is respected and falls back to 3000', async () => {
    const res1 = await GET(
      makeReq('http://localhost/api/report?address=test&radius=5000'),
    );
    const res2 = await GET(
      makeReq('http://localhost/api/report?address=test&radius=bogus'),
    );
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    const b1 = (await res1.json()) as { radiusMeters: number };
    const b2 = (await res2.json()) as { radiusMeters: number };
    expect(b1.radiusMeters).toBe(5000);
    expect(b2.radiusMeters).toBe(3000);
  });
});
