import { describe, expect, it } from 'vitest';
import { explainAll, tierFor, type ScoreExplanation } from '@/lib/engine/explain';
import type { Amenity, LivabilityScore, Permit, ScoreBreakdown } from '@/lib/types';

function makeAmenity(kind: Amenity['kind'], id: string): Amenity {
  return { id, kind, name: 'x', lat: 43.65, lon: -79.38, tags: {} };
}

const NEUTRAL: ScoreBreakdown = {
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

const SCORE: LivabilityScore = {
  total: 50,
  maxPossible: 100,
  breakdown: NEUTRAL,
  presence: {
    amenityDensity: true,
    transitScore: true,
    foodAccess: true,
    greenSpace: true,
    development: true,
    civicScore: true,
    cultureScore: true,
    recreationScore: true,
    serviceScore: true,
  },
  cityAverage: 50,
  ranking: { percentile: 50, label: 'Average' },
};

describe('tierFor', () => {
  it('EXCELLENT for >= 75', () => {
    expect(tierFor(75)).toBe('EXCELLENT');
    expect(tierFor(100)).toBe('EXCELLENT');
  });
  it('GOOD for >= 60', () => {
    expect(tierFor(60)).toBe('GOOD');
    expect(tierFor(74)).toBe('GOOD');
  });
  it('AVERAGE for >= 40', () => {
    expect(tierFor(40)).toBe('AVERAGE');
    expect(tierFor(59)).toBe('AVERAGE');
  });
  it('LOW for >= 25', () => {
    expect(tierFor(25)).toBe('LOW');
    expect(tierFor(39)).toBe('LOW');
  });
  it('MINIMAL for < 25', () => {
    expect(tierFor(0)).toBe('MINIMAL');
    expect(tierFor(24)).toBe('MINIMAL');
  });
});

describe('explainAll', () => {
  it('returns 9 explanations in the canonical order', () => {
    const ex = explainAll(SCORE, [], [], 3000);
    expect(ex).toHaveLength(9);
    const keys = ex.map((e) => e.key);
    expect(keys).toEqual([
      'amenityDensity',
      'transitScore',
      'foodAccess',
      'greenSpace',
      'development',
      'civicScore',
      'cultureScore',
      'recreationScore',
      'serviceScore',
    ]);
  });

  it('every explanation has the required fields', () => {
    const ex = explainAll(SCORE, [], [], 3000);
    for (const e of ex) {
      expect(e.label).toBeTruthy();
      expect(e.tier).toBeTruthy();
      expect(e.percentile).toBeTruthy();
      expect(e.weight).toBeGreaterThan(0);
      expect(e.contribution).toBeGreaterThanOrEqual(0);
      expect(e.maxContribution).toBeGreaterThan(0);
      expect(e.sentence).toBeTruthy();
      expect(e.benchmark.p10).toBeGreaterThanOrEqual(0);
      expect(e.benchmark.p90).toBeGreaterThanOrEqual(0);
    }
  });

  it('weights sum to 1.0', () => {
    const ex = explainAll(SCORE, [], [], 3000);
    const sum = ex.reduce((a, e) => a + e.weight, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  it('contribution = score × weight', () => {
    const ex = explainAll(SCORE, [], [], 3000);
    for (const e of ex) {
      const expected = Number((e.score * e.weight).toFixed(2));
      expect(e.contribution).toBe(expected);
    }
  });

  it('maxContribution = 100 × weight', () => {
    const ex = explainAll(SCORE, [], [], 3000);
    for (const e of ex) {
      const expected = Number((100 * e.weight).toFixed(2));
      expect(e.maxContribution).toBe(expected);
    }
  });

  it('contributions sum ≈ score.total', () => {
    const ex = explainAll(SCORE, [], [], 3000);
    const total = ex.reduce((a, e) => a + e.contribution, 0);
    expect(Math.abs(total - 50)).toBeLessThanOrEqual(1);
  });

  it('score 100 → EXCELLENT + Top 10%', () => {
    const ex = explainAll(
      {
        ...SCORE,
        breakdown: { ...NEUTRAL, amenityDensity: 100 },
        total: 100,
      },
      [],
      [],
      3000,
    );
    const amenity = ex.find((e) => e.key === 'amenityDensity')!;
    expect(amenity.tier).toBe('EXCELLENT');
    expect(amenity.percentile).toBe('Top 10%');
  });

  it('score 0 → MINIMAL + Bottom 25%', () => {
    const ex = explainAll(
      {
        ...SCORE,
        breakdown: { ...NEUTRAL, foodAccess: 0 },
        total: 0,
      },
      [],
      [],
      3000,
    );
    const food = ex.find((e) => e.key === 'foodAccess')!;
    expect(food.tier).toBe('MINIMAL');
    expect(food.percentile).toBe('Bottom 25%');
  });

  it('amenity density explanation includes restaurant/café/school sub-counts', () => {
    const amenities = [
      ...Array.from({ length: 100 }, (_, i) => makeAmenity('restaurant', `r${i}`)),
      ...Array.from({ length: 50 }, (_, i) => makeAmenity('cafe', `c${i}`)),
      ...Array.from({ length: 5 }, (_, i) => makeAmenity('school', `s${i}`)),
    ];
    const ex = explainAll(SCORE, amenities, [], 3000);
    const amenity = ex.find((e) => e.key === 'amenityDensity')!;
    expect(amenity.count).toBe(155);
    expect(amenity.countBreakdown).toEqual({
      restaurants: 100,
      cafes: 50,
      schools: 5,
    });
    expect(amenity.sentence).toMatch(/100 restaurants/);
    expect(amenity.sentence).toMatch(/50 cafes/);
  });

  it('radius scaling affects benchmark values', () => {
    const ex1km = explainAll(SCORE, [], [], 1000);
    const ex3km = explainAll(SCORE, [], [], 3000);
    const a1 = ex1km.find((e) => e.key === 'amenityDensity')!;
    const a3 = ex3km.find((e) => e.key === 'amenityDensity')!;
    expect(a3.benchmark.p10).toBeCloseTo(a1.benchmark.p10 * 9, 1);
  });
});
