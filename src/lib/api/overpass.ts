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

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const PER_CATEGORY_CAP = 2000;

function buildQuery(center: LatLon): string {
  const r = CONFIG.overpass.radiusMeters;
  const { lat, lon } = center;
  return (
    `[out:json][timeout:${CONFIG.overpass.timeoutSec}];` +
    `(` +
    `node["amenity"~"^(restaurant|cafe|fast_food|food_court|bar|pub|ice_cream|biergarten|pharmacy|bank|atm|post_office|school|kindergarten|college|university|library|hospital|clinic|doctors|dentist|police|fire_station|fuel)$"]` +
    `(around:${r},${lat},${lon});` +
    `node["shop"~"^(supermarket|convenience|mall|pharmacy|bakery|butcher|greengrocer|hairdresser|beauty|optician|books)$"]` +
    `(around:${r},${lat},${lon});` +
    `node["leisure"~"^(park|garden|nature_reserve|playground|sports_centre|fitness_centre|swimming_pool|pitch)$"]` +
    `(around:${r},${lat},${lon});` +
    `node["highway"="bus_stop"](around:${r},${lat},${lon});` +
    `node["public_transport"~"^(station|stop_position|platform)$"]` +
    `(around:${r},${lat},${lon});` +
    `node["railway"~"^(station|subway_entrance|tram_stop|light_rail|halt)$"]` +
    `(around:${r},${lat},${lon});` +
    `way["leisure"~"^(park|garden|nature_reserve)$"]` +
    `(around:${r},${lat},${lon});` +
    `way["landuse"~"^(park|forest|recreation_ground|meadow|grass|cemetery)$"]` +
    `(around:${r},${lat},${lon});` +
    `way["building"="construction"](around:${r},${lat},${lon});` +
    `way["landuse"="construction"](around:${r},${lat},${lon});` +
    `);` +
    `out tags center ${PER_CATEGORY_CAP};`
  );
}

function classifyAmenity(tags: Record<string, string>): AmenityKind | null {
  const a = tags.amenity;
  const s = tags.shop;
  const l = tags.leisure;
  const lu = tags.landuse;
  const r = tags.railway;
  const h = tags.highway;
  const pt = tags.public_transport;

  if (
    a === 'restaurant' ||
    a === 'fast_food' ||
    a === 'food_court' ||
    a === 'ice_cream' ||
    a === 'biergarten' ||
    a === 'bar' ||
    a === 'pub'
  ) {
    return 'restaurant';
  }
  if (a === 'cafe') return 'cafe';
  if (
    a === 'school' ||
    a === 'kindergarten' ||
    a === 'college' ||
    a === 'university' ||
    a === 'library'
  ) {
    return 'school';
  }
  if (
    a === 'marketplace' ||
    s === 'supermarket' ||
    s === 'convenience' ||
    s === 'bakery' ||
    s === 'greengrocer' ||
    s === 'butcher'
  ) {
    return 'grocery';
  }
  if (
    l === 'park' ||
    l === 'garden' ||
    l === 'nature_reserve' ||
    l === 'playground' ||
    lu === 'park' ||
    lu === 'forest' ||
    lu === 'recreation_ground' ||
    lu === 'meadow' ||
    lu === 'grass' ||
    lu === 'cemetery'
  ) {
    return 'park';
  }
  if (h === 'bus_stop') return 'bus_stop';
  if (
    r === 'station' ||
    r === 'subway_entrance' ||
    r === 'tram_stop' ||
    r === 'light_rail' ||
    r === 'halt' ||
    (pt && pt !== 'no')
  ) {
    return 'transit';
  }
  if (lu === 'construction' || tags.building === 'construction') {
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

type MirrorResult =
  | { ok: true; bytes: number; payload: OverpassPayload }
  | { ok: false; error: string };

async function tryMirror(
  mirrorUrl: string,
  query: string,
): Promise<MirrorResult> {
  const body = new URLSearchParams({ data: query }).toString();
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(),
    CONFIG.overpass.timeoutSec * 1000 + 5000,
  );
  try {
    const res = await fetch(mirrorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': CONFIG.overpass.userAgent,
      },
      body,
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const text = await res.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      return {
        ok: false,
        error: `Response too large (${text.length} bytes)`,
      };
    }
    try {
      const data = JSON.parse(text) as OverpassPayload;
      return { ok: true, bytes: text.length, payload: data };
    } catch (e) {
      return {
        ok: false,
        error: `JSON parse failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      };
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

function classify(elements: OverpassElement[]): OverpassResponse {
  const amenities: Amenity[] = [];
  const buildings: Amenity[] = [];
  const transit: Amenity[] = [];
  const landuse: Amenity[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const kind = classifyAmenity(tags);
    if (!kind) continue;
    const a = toAmenity(el, kind);
    if (!a) continue;

    if (amenities.length < PER_CATEGORY_CAP) amenities.push(a);
    if (kind === 'bus_stop' || kind === 'transit') {
      if (transit.length < PER_CATEGORY_CAP) transit.push(a);
    } else if (kind === 'construction' && el.type === 'way') {
      if (buildings.length < PER_CATEGORY_CAP) buildings.push(a);
    } else if (kind === 'park' && el.type === 'way') {
      if (landuse.length < PER_CATEGORY_CAP) landuse.push(a);
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

export async function fetchOverpass(center: LatLon): Promise<OverpassResponse> {
  const query = buildQuery(center);
  const mirrors =
    CONFIG.overpass.mirrors.length > 0
      ? CONFIG.overpass.mirrors
      : [CONFIG.overpass.url];

  let lastError = 'No mirrors configured';
  for (const url of mirrors) {
    const result = await tryMirror(url, query);
    if (result.ok) {
      return classify(result.payload.elements ?? []);
    }
    lastError = `${url}: ${result.error}`;
  }
  throw new Error(`All Overpass mirrors failed. Last error: ${lastError}`);
}
