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
    expect(body).toHaveProperty('address');
    expect(body).toHaveProperty('coords');
    expect(body).toHaveProperty('fetchedAt');
    expect(body).toHaveProperty('score');
    expect(body).toHaveProperty('amenities');
    expect(body).toHaveProperty('permits');
    expect(body).toHaveProperty('complaints');
    expect(body).toHaveProperty('anomalies');
    expect(body).toHaveProperty('trends');
    expect(body).toHaveProperty('sources');
  });
});
