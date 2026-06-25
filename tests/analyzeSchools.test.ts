import { describe, expect, it } from 'vitest';
import { analyzeSchools, computeBreakdown } from '@/lib/engine/score';
import type { Amenity, Permit } from '@/lib/types';

void ({} as Permit);

const CENTER = { lat: 43.65, lon: -79.38 };

function amenity(kind: Amenity['kind'], id: string, distM = 100): Amenity {
  const dLat = distM / 111320;
  const dLon = distM / (111320 * Math.cos((CENTER.lat * Math.PI) / 180));
  return {
    id,
    kind,
    name: kind === 'school' ? 'Test School' : 'X',
    lat: CENTER.lat + dLat,
    lon: CENTER.lon + dLon,
    tags: {},
  };
}

describe('analyzeSchools', () => {
  it('returns empty impacts when there are no schools', () => {
    const amenities = [
      amenity('restaurant', 'r1'),
      amenity('cafe', 'c1'),
    ];
    const r = analyzeSchools(amenities, [], 1500, CENTER, { nowMs: Date.now() });
    expect(r.impacts).toEqual([]);
  });

  it('returns one impact per school with non-negative delta', () => {
    const amenities = [
      amenity('restaurant', 'r1'),
      amenity('cafe', 'c1'),
      amenity('school', 's1'),
      amenity('school', 's2'),
      amenity('school', 's3'),
    ];
    const r = analyzeSchools(amenities, [], 1500, CENTER, { nowMs: Date.now() });
    expect(r.impacts).toHaveLength(3);
    for (const i of r.impacts) {
      expect(i.delta).toBeGreaterThanOrEqual(0);
    }
  });

  it('is sorted by delta desc, then distance asc', () => {
    const amenities = [
      amenity('school', 'near', 100),
      amenity('school', 'mid', 500),
      amenity('school', 'far', 2000),
    ];
    const r = analyzeSchools(amenities, [], 3000, CENTER, { nowMs: Date.now() });
    for (let i = 1; i < r.impacts.length; i++) {
      const a = r.impacts[i - 1]!;
      const b = r.impacts[i]!;
      if (a.delta === b.delta) {
        expect(a.distanceKm).toBeLessThanOrEqual(b.distanceKm);
      } else {
        expect(a.delta).toBeGreaterThanOrEqual(b.delta);
      }
    }
  });
});

void computeBreakdown;

