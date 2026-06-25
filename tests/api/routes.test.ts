import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/anomalies/route';
import { POST as whatifPost } from '@/app/api/whatif/route';
import { POST as forecastPost } from '@/app/api/forecast/route';
import { detectAnomalies } from '@/lib/engine/anomalies';

function makeJsonReq(body: unknown): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validAnomalyBody = {
  permitsLast30d: 3,
  permitsLast6m: 12,
  complaintsLast30d: 2,
  complaintsLast90d: 8,
  amenityCounts: {
    restaurant: 10,
    cafe: 5,
    school: 3,
    grocery: 4,
    park: 2,
    transit: 12,
    construction: 4,
  },
  scoreBreakdown: {
    amenityDensity: 50,
    transitScore: 70,
    foodAccess: 60,
    greenSpace: 40,
    development: 50,
    civicScore: 50,
    cultureScore: 50,
    recreationScore: 50,
    serviceScore: 50,
  },
};

describe('POST /api/anomalies', () => {
  it('returns 400 on invalid JSON', async () => {
    const res = await POST(
      new Request('http://localhost/api/anomalies', {
        method: 'POST',
        body: '{not json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(
      makeJsonReq({ permitsLast30d: 1, permitsLast6m: 1 }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Requires/);
  });

  it('returns anomaly array for valid input', async () => {
    const res = await POST(makeJsonReq(validAnomalyBody));
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('POST /api/whatif', () => {
  const current = {
    amenityDensity: 50,
    transitScore: 50,
    foodAccess: 50,
    greenSpace: 50,
    development: 50,
    civicScore: 50,
    cultureScore: 50,
    recreationScore: 50,
    serviceScore: 50,
  };

  it('returns 400 when current or scenarioId is missing', async () => {
    const r1 = await whatifPost(makeJsonReq({}));
    expect(r1.status).toBe(400);
    const r2 = await whatifPost(makeJsonReq({ current }));
    expect(r2.status).toBe(400);
  });

  it('returns 400 for unknown scenarioId', async () => {
    const res = await whatifPost(
      makeJsonReq({ current, scenarioId: 'nope-nope-nope' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns scenario result for known scenarioId', async () => {
    const res = await whatifPost(
      makeJsonReq({ current, scenarioId: 'park' }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.scenarioId).toBe('park');
    expect(typeof body.delta).toBe('number');
  });
});

describe('POST /api/forecast', () => {
  it('returns 400 when series is missing', async () => {
    const res = await forecastPost(makeJsonReq({}));
    expect(res.status).toBe(400);
  });

  it('returns trends for valid series', async () => {
    const res = await forecastPost(
      makeJsonReq({
        series: [
          { name: 'Permits', history: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
          { name: 'Complaints', history: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0] },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ signal: string }>;
    expect(body.length).toBe(2);
    expect(body[0]!.signal).toBe('Permits');
  });

  it('handles empty / malformed history gracefully', async () => {
    const res = await forecastPost(
      makeJsonReq({ series: [{ name: 'X', history: 'not an array' }] }),
    );
    expect(res.status).toBe(200);
  });
});

describe('detectAnomalies edge cases (engine, exercised via API)', () => {
  it('handles null airQuality and census without throwing', () => {
    const out = detectAnomalies({
      ...validAnomalyBody,
      airQuality: null,
      census: null,
    });
    expect(Array.isArray(out)).toBe(true);
  });
});
