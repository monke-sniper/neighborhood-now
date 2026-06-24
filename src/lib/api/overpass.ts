import { CONFIG } from '../config';
import type { Amenity, AmenityKind, LatLon, OverpassResponse } from '../types';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassPayload {
  elements?: OverpassElement[];
}

function buildQuery(center: LatLon): string {
  const r = CONFIG.overpass.radiusMeters;
  const { lat, lon } = center;
  return (
    `[out:json][timeout:${CONFIG.overpass.timeoutSec}];` +
    `(` +
    `node["amenity"](around:${r},${lat},${lon});` +
    `node["shop"~"supermarket|convenience"](around:${r},${lat},${lon});` +
    `node["leisure"~"park|garden"](around:${r},${lat},${lon});` +
    `way["building"](around:${r},${lat},${lon});` +
    `node["highway"="bus_stop"](around:${r},${lat},${lon});` +
    `node["public_transport"](around:${r},${lat},${lon});` +
    `way["landuse"](around:${r},${lat},${lon});` +
    `);` +
    `out center;`
  );
}

function classifyAmenity(tags: Record<string, string>): AmenityKind | null {
  if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food' || tags.amenity === 'food_court') {
    return 'restaurant';
  }
  if (tags.amenity === 'cafe') return 'cafe';
  if (tags.amenity === 'school' || tags.amenity === 'kindergarten' || tags.amenity === 'college' || tags.amenity === 'university') {
    return 'school';
  }
  if (tags.amenity === 'marketplace' || tags.shop === 'supermarket' || tags.shop === 'convenience') {
    return 'grocery';
  }
  if (tags.leisure === 'park' || tags.leisure === 'garden' || tags.leisure === 'nature_reserve') {
    return 'park';
  }
  if (tags.landuse === 'construction' || tags.building === 'construction') {
    return 'construction';
  }
  return null;
}

function toAmenity(el: OverpassElement, kind: AmenityKind): Amenity | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  return {
    id: `${el.type}/${el.id}`,
    kind,
    name: el.tags?.name,
    lat,
    lon,
    tags: el.tags ?? {},
  };
}

export async function fetchOverpass(center: LatLon): Promise<OverpassResponse> {
  const query = buildQuery(center);
  const body = new URLSearchParams({ data: query }).toString();

  const res = await fetch(CONFIG.overpass.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Overpass HTTP ${res.status}`);
  }
  const data = (await res.json()) as OverpassPayload;
  const elements = data.elements ?? [];

  const amenities: Amenity[] = [];
  const buildings: Amenity[] = [];
  const transit: Amenity[] = [];
  const landuse: Amenity[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    if (tags.amenity || tags.shop || tags.leisure) {
      const kind = classifyAmenity(tags);
      if (kind) {
        const a = toAmenity(el, kind);
        if (a) amenities.push(a);
      }
    } else if (tags.highway === 'bus_stop') {
      const a = toAmenity(el, 'bus_stop');
      if (a) transit.push(a);
    } else if (tags.public_transport) {
      const a = toAmenity(el, 'transit');
      if (a) transit.push(a);
    } else if (tags.building) {
      const a = toAmenity(el, 'construction');
      if (a) buildings.push(a);
    } else if (tags.landuse) {
      const a = toAmenity(el, 'construction');
      if (a) landuse.push(a);
    }
  }

  return {
    amenities,
    buildings,
    transit,
    landuse,
    rawCount: elements.length,
  };
}
