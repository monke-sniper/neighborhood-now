import { describe, expect, it } from 'vitest';
import { extractJson, fallbackRecs, sanitizeRecs } from '@/lib/engine/recommend';
import type { NeighborhoodReport } from '@/lib/types';

function makeReport(overrides: Partial<NeighborhoodReport['score']['breakdown']> = {}): NeighborhoodReport {
  return {
    address: 'test',
    coords: { lat: 43.65, lon: -79.38 },
    fetchedAt: new Date().toISOString(),
    radiusMeters: 3000,
    score: {
      total: 50,
      breakdown: {
        amenityDensity: overrides.amenityDensity ?? 50,
        transitScore: overrides.transitScore ?? 50,
        foodAccess: overrides.foodAccess ?? 50,
        greenSpace: overrides.greenSpace ?? 50,
        development: overrides.development ?? 50,
        civicScore: overrides.civicScore ?? 50,
        cultureScore: overrides.cultureScore ?? 50,
        recreationScore: overrides.recreationScore ?? 50,
        serviceScore: overrides.serviceScore ?? 50,
      },
      cityAverage: 50,
      ranking: { percentile: 50, label: 'Average' },
    },
    amenities: {
      amenities: [],
      buildings: [],
      transit: [],
      landuse: [],
      rawCount: 0,
    },
    permits: [],
    complaints: [],
    anomalies: [],
    trends: [],
    explanations: [],
    sources: {
      overpass: 'ok',
      builddata: 'ok',
      complaints: 'ok',
      census: 'skipped',
      weather: 'skipped',
    },
  };
}

describe('extractJson', () => {
  it('parses raw JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses JSON inside markdown fences', () => {
    const text = 'Here is the result:\n```json\n{"a":2}\n```\nDone.';
    expect(extractJson(text)).toEqual({ a: 2 });
  });

  it('parses JSON with surrounding prose', () => {
    const text = 'Sure! {"x": 5} Here you go.';
    expect(extractJson(text)).toEqual({ x: 5 });
  });

  it('returns null on completely invalid input', () => {
    expect(extractJson('not json at all')).toBeNull();
  });

  it('returns null on empty string', () => {
    expect(extractJson('')).toBeNull();
  });
});

describe('sanitizeRecs', () => {
  it('returns empty array for non-object', () => {
    expect(sanitizeRecs(null)).toEqual([]);
    expect(sanitizeRecs('string')).toEqual([]);
  });

  it('returns empty if recommendations is missing', () => {
    expect(sanitizeRecs({ foo: 'bar' })).toEqual([]);
  });

  it('keeps only valid scenarioIds', () => {
    const parsed = {
      recommendations: [
        { id: 'r1', title: 'a', reasoning: 'b', scenarioId: 'subway', expectedDelta: 5 },
        { id: 'r2', title: 'c', reasoning: 'd', scenarioId: 'fake_id', expectedDelta: 5 },
        { id: 'r3', title: 'e', reasoning: 'f', scenarioId: 'park', expectedDelta: 5 },
      ],
    };
    const out = sanitizeRecs(parsed);
    expect(out).toHaveLength(2);
    expect(out[0]!.scenarioId).toBe('subway');
    expect(out[1]!.scenarioId).toBe('park');
  });

  it('clamps expectedDelta to 0-25', () => {
    const parsed = {
      recommendations: [
        { id: 'r1', title: 'a', reasoning: 'b', scenarioId: 'subway', expectedDelta: 999 },
        { id: 'r2', title: 'c', reasoning: 'd', scenarioId: 'park', expectedDelta: -10 },
      ],
    };
    const out = sanitizeRecs(parsed);
    expect(out[0]!.expectedDelta).toBe(25);
    expect(out[1]!.expectedDelta).toBe(0);
  });

  it('skips recommendations with empty title or reasoning', () => {
    const parsed = {
      recommendations: [
        { id: 'r1', title: '', reasoning: 'b', scenarioId: 'subway', expectedDelta: 5 },
        { id: 'r2', title: 'c', reasoning: '', scenarioId: 'park', expectedDelta: 5 },
        { id: 'r3', title: 'e', reasoning: 'f', scenarioId: 'grocery', expectedDelta: 5 },
      ],
    };
    const out = sanitizeRecs(parsed);
    expect(out).toHaveLength(1);
    expect(out[0]!.scenarioId).toBe('grocery');
  });

  it('caps at 3 recommendations', () => {
    const parsed = {
      recommendations: Array.from({ length: 10 }, (_, i) => ({
        id: `r${i}`,
        title: `t${i}`,
        reasoning: `r${i}`,
        scenarioId: 'subway',
        expectedDelta: 5,
      })),
    };
    const out = sanitizeRecs(parsed);
    expect(out).toHaveLength(3);
  });
});

describe('fallbackRecs', () => {
  it('returns at most 2 recommendations for 2 weakest components', () => {
    const r = makeReport({
      transitScore: 10,
      greenSpace: 5,
      foodAccess: 90,
    });
    const out = fallbackRecs(r);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.length).toBeLessThanOrEqual(3);
  });

  it('recommends the scenario for the weakest component', () => {
    const r = makeReport({ transitScore: 0 });
    const out = fallbackRecs(r);
    expect(out[0]!.scenarioId).toBe('subway');
  });

  it('avoids duplicate scenarioIds', () => {
    const r = makeReport({ amenityDensity: 0, development: 0 });
    const out = fallbackRecs(r);
    const ids = out.map((x) => x.scenarioId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
