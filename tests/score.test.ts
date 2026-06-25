import { describe, expect, it } from 'vitest';
import { computeBreakdown, computeRanking, computeTotal } from '@/lib/engine/score';
import type { Amenity, Permit, ScoreBreakdown } from '@/lib/types';

function amenity(kind: Amenity['kind'], id = '1'): Amenity {
  return {
    id,
    kind,
    name: 'test',
    lat: 43.65,
    lon: -79.38,
    tags: {},
  };
}

function permit(issuedDate: string, id = '1'): Permit {
  return {
    id,
    address: '123 Test',
    lat: 43.65,
    lon: -79.38,
    description: 'test',
    issuedDate,
    structureType: 'Mixed Use',
    status: 'Issued',
  };
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

describe('computeBreakdown', () => {
  it('returns reasonable breakdown for empty input (no 13/100 floor)', () => {
    const result = computeBreakdown([], []);
    expect(result.breakdown.amenityDensity).toBe(0);
    expect(result.breakdown.foodAccess).toBe(0);
    expect(result.breakdown.transitScore).toBe(0);
    expect(result.breakdown.development).toBeGreaterThanOrEqual(0);
  });

  it('produces high score for downtown-density amenities', () => {
    const amenities: Amenity[] = [
      ...Array.from({ length: 900 }, (_, i) => amenity('restaurant', `r${i}`)),
      ...Array.from({ length: 200 }, (_, i) => amenity('cafe', `c${i}`)),
      ...Array.from({ length: 20 }, (_, i) => amenity('school', `s${i}`)),
      ...Array.from({ length: 120 }, (_, i) => amenity('grocery', `g${i}`)),
      ...Array.from({ length: 200 }, (_, i) => amenity('bus_stop', `b${i}`)),
    ];
    const result = computeBreakdown(amenities, []);
    expect(result.breakdown.amenityDensity).toBeGreaterThan(80);
    expect(result.breakdown.foodAccess).toBeGreaterThan(60);
    expect(result.breakdown.transitScore).toBeGreaterThan(60);
  });

  it('produces low score for sparse suburban area', () => {
    const amenities: Amenity[] = [
      amenity('restaurant', 'r1'),
      amenity('cafe', 'c1'),
      amenity('school', 's1'),
    ];
    const result = computeBreakdown(amenities, []);
    expect(result.breakdown.amenityDensity).toBeLessThan(20);
    expect(result.breakdown.foodAccess).toBeLessThan(20);
  });

  it('counts recent permits in 6-month window only', () => {
    const now = Date.now();
    const recent = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const old = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();
    const permits = [permit(recent, 'r1'), permit(old, 'o1')];
    const amenities = Array.from({ length: 5 }, (_, i) =>
      amenity('construction', `c${i}`),
    );
    const a = computeBreakdown(amenities, permits);
    const b = computeBreakdown(amenities, [permit(old, 'o1')]);
    expect(a.breakdown.development).toBeGreaterThanOrEqual(b.breakdown.development);
  });

  it('handles 0 amenities without crashing or returning the old 13/100 floor', () => {
    const result = computeBreakdown([], []);
    const total = computeTotal(result.breakdown, { presence: result.presence }).total;
    expect(total).toBeGreaterThanOrEqual(0);
    expect(total).toBeLessThanOrEqual(100);
  });

  it('marks components with 0 data as not present', () => {
    const amenities: Amenity[] = [
      amenity('restaurant', 'r1'),
      amenity('cafe', 'c1'),
    ];
    const result = computeBreakdown(amenities, []);
    expect(result.presence.amenityDensity).toBe(true);
    expect(result.presence.transitScore).toBe(false);
    expect(result.presence.foodAccess).toBe(false);
    expect(result.presence.greenSpace).toBe(false);
    expect(result.presence.civicScore).toBe(false);
  });
});

describe('computeTotal (out-of-N dynamic denominator)', () => {
  it('excludes missing components from maxPossible', () => {
    const all: ScoreBreakdown = {
      amenityDensity: 80,
      transitScore: 70,
      foodAccess: 60,
      greenSpace: 50,
      development: 40,
      civicScore: 30,
      cultureScore: 20,
      recreationScore: 15,
      serviceScore: 10,
    };
    const presence: import('@/lib/engine/score').DataPresence = {
      amenityDensity: true,
      transitScore: true,
      foodAccess: false,
      greenSpace: false,
      development: true,
      civicScore: false,
      cultureScore: false,
      recreationScore: false,
      serviceScore: false,
    };
    const result = computeTotal(all, { presence });
    const presentWeight =
      0.18 + 0.18 + 0.1;
    expect(result.maxPossible).toBe(Math.round(presentWeight * 100));
    expect(result.presence).toEqual(presence);
  });

  it('renormalizes so 4/9 components with data gives a fair score', () => {
    const four: ScoreBreakdown = {
      amenityDensity: 100,
      transitScore: 100,
      foodAccess: 100,
      greenSpace: 100,
      development: 0,
      civicScore: 0,
      cultureScore: 0,
      recreationScore: 0,
      serviceScore: 0,
    };
    const presence: import('@/lib/engine/score').DataPresence = {
      amenityDensity: true,
      transitScore: true,
      foodAccess: true,
      greenSpace: true,
      development: false,
      civicScore: false,
      cultureScore: false,
      recreationScore: false,
      serviceScore: false,
    };
    const result = computeTotal(four, { presence });
    expect(result.total).toBe(100);
    expect(result.maxPossible).toBe(60);
  });

  it('returns 0/0 when all components missing', () => {
    const all: ScoreBreakdown = {
      amenityDensity: 0,
      transitScore: 0,
      foodAccess: 0,
      greenSpace: 0,
      development: 0,
      civicScore: 0,
      cultureScore: 0,
      recreationScore: 0,
      serviceScore: 0,
    };
    const presence: import('@/lib/engine/score').DataPresence = {
      amenityDensity: false,
      transitScore: false,
      foodAccess: false,
      greenSpace: false,
      development: false,
      civicScore: false,
      cultureScore: false,
      recreationScore: false,
      serviceScore: false,
    };
    const result = computeTotal(all, { presence });
    expect(result.total).toBe(0);
    expect(result.maxPossible).toBe(0);
  });
});

describe('computeTotal (legacy / no presence)', () => {
  it('returns 100 when all components are 100', () => {
    const max: ScoreBreakdown = {
      amenityDensity: 100,
      transitScore: 100,
      foodAccess: 100,
      greenSpace: 100,
      development: 100,
      civicScore: 100,
      cultureScore: 100,
      recreationScore: 100,
      serviceScore: 100,
    };
    expect(computeTotal(max).total).toBe(100);
    expect(computeTotal(max).maxPossible).toBe(100);
  });

  it('returns 0 when all components are 0', () => {
    const min: ScoreBreakdown = {
      amenityDensity: 0,
      transitScore: 0,
      foodAccess: 0,
      greenSpace: 0,
      development: 0,
      civicScore: 0,
      cultureScore: 0,
      recreationScore: 0,
      serviceScore: 0,
    };
    expect(computeTotal(min).total).toBe(0);
  });

  it('returns ~50 for neutral breakdown (50/50/50/50/50)', () => {
    const t = computeTotal(NEUTRAL).total;
    expect(Math.abs(t - 50)).toBeLessThanOrEqual(1);
  });

  it('always returns 0-100 range', () => {
    const t1 = computeTotal({
      amenityDensity: 1000,
      transitScore: 1000,
      foodAccess: 1000,
      greenSpace: 1000,
      development: 1000,
      civicScore: 1000,
      cultureScore: 1000,
      recreationScore: 1000,
      serviceScore: 1000,
    }).total;
    expect(t1).toBeLessThanOrEqual(100);
    const t2 = computeTotal({
      amenityDensity: -100,
      transitScore: -100,
      foodAccess: -100,
      greenSpace: -100,
      development: -100,
      civicScore: -100,
      cultureScore: -100,
      recreationScore: -100,
      serviceScore: -100,
    }).total;
    expect(t2).toBeGreaterThanOrEqual(0);
  });

  it('returns ranking field', () => {
    const result = computeTotal(NEUTRAL);
    expect(result.ranking).toBeDefined();
    expect(typeof result.ranking.label).toBe('string');
    expect(result.ranking.percentile).toBeGreaterThanOrEqual(0);
    expect(result.ranking.percentile).toBeLessThanOrEqual(100);
  });
});

describe('computeRanking', () => {
  it('returns "Top 10%" for scores >= 90', () => {
    expect(computeRanking(95).label).toBe('Top 10%');
    expect(computeRanking(100).label).toBe('Top 10%');
  });
  it('returns "Bottom 25%" for scores < 25', () => {
    expect(computeRanking(10).label).toBe('Bottom 25%');
  });
  it('returns "Average" for ~50', () => {
    expect(computeRanking(50).label).toBe('Average');
  });
  it('clamps out-of-range scores', () => {
    expect(computeRanking(150).label).toBe('Top 10%');
    expect(computeRanking(-50).label).toBe('Bottom 25%');
  });
});
