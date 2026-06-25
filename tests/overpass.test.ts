import { describe, expect, it } from 'vitest';
import {
  buildOverpassQuery,
  PER_CATEGORY_CAP_PUBLIC,
} from '@/lib/api/overpass';

describe('buildOverpassQuery', () => {
  it('uses the configured PER_CATEGORY_CAP in the out statement', () => {
    const q = buildOverpassQuery({ lat: 43.65, lon: -79.38 }, 3000);
    expect(q).toContain(`out tags center ${PER_CATEGORY_CAP_PUBLIC}`);
  });

  it('does not include rare patterns removed for speed', () => {
    const q = buildOverpassQuery({ lat: 43.65, lon: -79.38 }, 3000);
    expect(q).not.toContain('events_venue');
    expect(q).not.toContain('social_facility');
    expect(q).not.toContain('biergarten');
    expect(q).not.toContain('food_court');
    expect(q).not.toContain('recycling');
    expect(q).not.toContain('fire_station');
  });

  it('does not query highway=bus_stop (covered by public_transport)', () => {
    const q = buildOverpassQuery({ lat: 43.65, lon: -79.38 }, 3000);
    expect(q).not.toContain('"highway"="bus_stop"');
  });

  it('does not query railway=halt (rare)', () => {
    const q = buildOverpassQuery({ lat: 43.65, lon: -79.38 }, 3000);
    expect(q).not.toContain('halt');
  });

  it('uses configured timeout', () => {
    const q = buildOverpassQuery({ lat: 43.65, lon: -79.38 }, 3000);
    expect(q).toMatch(/\[timeout:\d+\]/);
  });

  it('still queries the 12 kinds needed for scoring', () => {
    const q = buildOverpassQuery({ lat: 43.65, lon: -79.38 }, 3000);
    expect(q).toContain('restaurant');
    expect(q).toContain('cafe');
    expect(q).toContain('school');
    expect(q).toContain('supermarket');
    expect(q).toContain('community_centre');
    expect(q).toContain('museum');
    expect(q).toContain('sports_centre');
    expect(q).toContain('hairdresser');
    expect(q).toContain('park');
  });
});
