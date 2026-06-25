import { describe, expect, it } from 'vitest';
import { hasRealName, pickName } from '@/lib/utils/amenity';
import type { Amenity } from '@/lib/types';

function a(tags: Record<string, string>, id = '1'): Amenity {
  return {
    id: `node/${id}`,
    kind: 'park',
    name: tags.name,
    lat: 43.65,
    lon: -79.38,
    tags,
  };
}

describe('pickName', () => {
  it('uses tags.name when present', () => {
    expect(pickName(a({ name: 'Podium Green Roof' }))).toBe('Podium Green Roof');
  });

  it('falls back to name:en when name is missing', () => {
    expect(pickName(a({ 'name:en': 'Gardens of Justice' }))).toBe(
      'Gardens of Justice',
    );
  });

  it('falls back to brand', () => {
    expect(pickName(a({ brand: 'Starbucks' }))).toBe('Starbucks');
  });

  it('falls back to operator', () => {
    expect(pickName(a({ operator: 'Toronto Public Library' }))).toBe(
      'Toronto Public Library',
    );
  });

  it('falls back to ref', () => {
    expect(pickName(a({ ref: '12A' }))).toBe('12A');
  });

  it('derives kind label from leisure tag when no name', () => {
    expect(pickName(a({ leisure: 'playground' }, '2827025301'))).toBe(
      'Playground (unnamed)',
    );
  });

  it('derives kind label from amenity tag when no name', () => {
    expect(pickName(a({ amenity: 'car_repair' }))).toBe(
      'Car repair (unnamed)',
    );
  });

  it('derives kind label from shop tag when no name', () => {
    expect(pickName(a({ shop: 'florist' }))).toBe('Florist (unnamed)');
  });

  it('derives kind label from landuse tag when no name', () => {
    expect(pickName(a({ landuse: 'forest' }))).toBe('Forest (unnamed)');
  });

  it('derives kind label from highway tag when no name', () => {
    expect(pickName(a({ highway: 'bus_stop' }))).toBe('Bus stop (unnamed)');
  });

  it('falls back to kind/id when no tags at all', () => {
    expect(pickName(a({}, '12345'))).toBe('park/12345');
  });

  it('handles multi-word tag values', () => {
    expect(pickName(a({ amenity: 'place_of_worship' }))).toBe(
      'Place of worship (unnamed)',
    );
  });

  it('prefers leisure over amenity for fallback', () => {
    expect(
      pickName(a({ leisure: 'park', amenity: 'restaurant' }, '1')),
    ).toBe('Park (unnamed)');
  });
});

describe('hasRealName', () => {
  it('returns true when name tag is present', () => {
    expect(hasRealName(a({ name: 'X' }))).toBe(true);
  });
  it('returns true when name:en is present', () => {
    expect(hasRealName(a({ 'name:en': 'X' }))).toBe(true);
  });
  it('returns true when brand is present', () => {
    expect(hasRealName(a({ brand: 'X' }))).toBe(true);
  });
  it('returns true when operator is present', () => {
    expect(hasRealName(a({ operator: 'X' }))).toBe(true);
  });
  it('returns true when ref is present', () => {
    expect(hasRealName(a({ ref: 'X' }))).toBe(true);
  });
  it('returns false when only kind/landuse tags present', () => {
    expect(hasRealName(a({ leisure: 'playground' }))).toBe(false);
  });
  it('returns false when empty', () => {
    expect(hasRealName(a({}))).toBe(false);
  });
});
