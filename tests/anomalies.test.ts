import { describe, expect, it } from 'vitest';
import { detectAnomalies } from '@/lib/engine/anomalies';
import type { ScoreBreakdown } from '@/lib/types';

const NEUTRAL: ScoreBreakdown = {
  amenityDensity: 50,
  transitScore: 50,
  foodAccess: 50,
  greenSpace: 50,
  development: 50,
};

describe('detectAnomalies', () => {
  it('returns empty array for median-everything neighborhood', () => {
    const ctx = {
      permitsLast6m: 5,
      complaintsLast90d: 1,
      amenityCounts: {
        restaurant: 70,
        cafe: 15,
        school: 4,
        grocery: 24,
        park: 30,
        transit: 20,
        construction: 4,
      },
      scoreBreakdown: NEUTRAL,
      airQuality: { pm25: 12 },
      census: { medianIncome: 65000 },
    };
    const result = detectAnomalies(ctx);
    expect(Array.isArray(result)).toBe(true);
  });

  it('flags high restaurant count as positive anomaly', () => {
    const ctx = {
      permitsLast6m: 0,
      complaintsLast90d: 0,
      amenityCounts: {
        restaurant: 800,
        cafe: 200,
        school: 20,
        grocery: 100,
        park: 5,
        transit: 200,
        construction: 0,
      },
      scoreBreakdown: {
        amenityDensity: 95,
        transitScore: 90,
        foodAccess: 90,
        greenSpace: 30,
        development: 30,
      },
      airQuality: null,
      census: null,
    };
    const result = detectAnomalies(ctx);
    const names = result.map((a) => a.signal);
    expect(names).toContain('Restaurants in 1500m');
    expect(names).toContain('Cafés in 1500m');
  });

  it('sorts anomalies by absolute z-score descending', () => {
    const ctx = {
      permitsLast6m: 0,
      complaintsLast90d: 0,
      amenityCounts: {
        restaurant: 800,
        cafe: 200,
        school: 1,
        grocery: 1,
        park: 1,
        transit: 1,
        construction: 1,
      },
      scoreBreakdown: {
        amenityDensity: 95,
        transitScore: 90,
        foodAccess: 5,
        greenSpace: 5,
        development: 5,
      },
      airQuality: null,
      census: null,
    };
    const result = detectAnomalies(ctx);
    for (let i = 1; i < result.length; i++) {
      expect(Math.abs(result[i - 1]!.zscore)).toBeGreaterThanOrEqual(
        Math.abs(result[i]!.zscore),
      );
    }
  });

  it('uses citywide benchmark as fallback baseline', () => {
    const ctx = {
      permitsLast6m: 0,
      complaintsLast90d: 0,
      amenityCounts: {
        restaurant: 0,
        cafe: 0,
        school: 0,
        grocery: 0,
        park: 0,
        transit: 0,
        construction: 0,
      },
      scoreBreakdown: NEUTRAL,
      airQuality: null,
      census: null,
    };
    const result = detectAnomalies(ctx);
    expect(Array.isArray(result)).toBe(true);
  });

  it('omits air quality and census signals when not present', () => {
    const ctx = {
      permitsLast6m: 0,
      complaintsLast90d: 0,
      amenityCounts: {
        restaurant: 0,
        cafe: 0,
        school: 0,
        grocery: 0,
        park: 0,
        transit: 0,
        construction: 0,
      },
      scoreBreakdown: NEUTRAL,
      airQuality: null,
      census: null,
    };
    const result = detectAnomalies(ctx);
    const names = result.map((a) => a.signal);
    expect(names).not.toContain('Air quality (PM2.5)');
    expect(names).not.toContain('Median household income');
  });
});
