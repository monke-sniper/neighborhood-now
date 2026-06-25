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

const MAX_RESPONSE_BYTES = 50 * 1024 * 1024;
const PER_CATEGORY_CAP = 2000;
export const PER_CATEGORY_CAP_PUBLIC = PER_CATEGORY_CAP;
const PRIMARY_TIMEOUT_MS = 5000;
const FALLBACK_TIMEOUT_MS = 2500;
const FALLBACK_RADIUS = 1000;

export function buildOverpassQuery(center: LatLon, radiusMeters: number): string {
  const r = radiusMeters;
  const { lat, lon } = center;
  return (
    `[out:json][timeout:${CONFIG.overpass.timeoutSec}];` +
    `(` +
    `node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|ice_cream|pharmacy|bank|atm|post_office|school|kindergarten|college|university|library|hospital|clinic|doctors|dentist|police|fuel|community_centre|townhall|courthouse|place_of_worship|arts_centre|museum|theatre|cinema|car_repair|car_wash|hairdresser|beauty|optician|florist|jewelry|laundry|dry_cleaning)$"]` +
    `(around:${r},${lat},${lon});` +
    `node["shop"~"^(supermarket|convenience|mall|pharmacy|bakery|butcher|greengrocer|books|florist|jewelry|laundry)$"]` +
    `(around:${r},${lat},${lon});` +
    `node["leisure"~"^(park|garden|nature_reserve|playground|sports_centre|fitness_centre|swimming_pool|pitch|golf_course|dog_park)$"]` +
    `(around:${r},${lat},${lon});` +
    `node["public_transport"~"^(station|stop_position|platform)$"]` +
    `(around:${r},${lat},${lon});` +
    `node["railway"~"^(station|subway_entrance|tram_stop|light_rail)$"]` +
    `(around:${r},${lat},${lon});` +
    `way["leisure"~"^(park|garden|nature_reserve|playground|sports_centre|fitness_centre|swimming_pool|pitch|golf_course|dog_park)$"]` +
    `(around:${r},${lat},${lon});` +
    `way["landuse"~"^(forest|recreation_ground)$"]` +
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
    l === 'sports_centre' ||
    l === 'fitness_centre' ||
    l === 'swimming_pool' ||
    l === 'pitch' ||
    l === 'golf_course' ||
    l === 'dog_park' ||
    l === 'playground' ||
    lu === 'recreation_ground'
  ) {
    return 'recreation';
  }
  if (
    l === 'park' ||
    l === 'garden' ||
    l === 'nature_reserve' ||
    lu === 'park' ||
    lu === 'forest'
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
  if (
    a === 'community_centre' ||
    a === 'social_facility' ||
    a === 'townhall' ||
    a === 'courthouse' ||
    a === 'place_of_worship' ||
    a === 'recycling' ||
    a === 'hospital' ||
    a === 'clinic' ||
    a === 'doctors' ||
    a === 'dentist' ||
    a === 'police' ||
    a === 'fire_station' ||
    a === 'post_office'
  ) {
    return 'civic';
  }
  if (
    a === 'arts_centre' ||
    a === 'museum' ||
    a === 'theatre' ||
    a === 'cinema' ||
    a === 'events_venue'
  ) {
    return 'culture';
  }
  if (
    a === 'car_repair' ||
    a === 'car_wash' ||
    a === 'hairdresser' ||
    a === 'beauty' ||
    a === 'optician' ||
    a === 'florist' ||
    a === 'jewelry' ||
    a === 'laundry' ||
    a === 'dry_cleaning' ||
    a === 'pharmacy' ||
    a === 'bank' ||
    a === 'atm' ||
    s === 'hairdresser' ||
    s === 'beauty' ||
    s === 'optician' ||
    s === 'florist' ||
    s === 'jewelry' ||
    s === 'laundry'
  ) {
    return 'service';
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
      throw new Error(`HTTP ${res.status} from ${mirrorUrl}`);
    }
    const text = await res.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new Error(`Response too large (${text.length} bytes) from ${mirrorUrl}`);
    }
    try {
      const data = JSON.parse(text) as OverpassPayload;
      return { ok: true, bytes: text.length, payload: data };
    } catch (e) {
      throw new Error(
        `JSON parse failed from ${mirrorUrl}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
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

export async function fetchOverpass(
  center: LatLon,
  radiusMeters: number = CONFIG.overpass.defaultRadius,
): Promise<OverpassResponse> {
  const query = buildOverpassQuery(center, radiusMeters);
  const mirrors =
    CONFIG.overpass.mirrors.length > 0
      ? CONFIG.overpass.mirrors
      : [CONFIG.overpass.url];

  if (mirrors.length === 1) {
    const result = await tryMirror(mirrors[0]!, query);
    if (result.ok) return classify(result.payload.elements ?? []);
    throw new Error(`Overpass mirror ${mirrors[0]} failed: ${result.error}`);
  }

  const attempts = mirrors.map((url) =>
    tryMirror(url, query).then(
      (r) => {
        if (r.ok) return r;
        throw new Error(`${url}: ${r.error}`);
      },
      (e) => {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`${url}: ${msg}`);
      },
    ),
  );

  try {
    const winner = await Promise.any(attempts);
    if (winner.ok) return classify(winner.payload.elements ?? []);
    throw new Error('All mirrors returned no payload');
  } catch (aggErr) {
    const errors =
      aggErr instanceof AggregateError
        ? aggErr.errors.map((e) => (e instanceof Error ? e.message : String(e)))
        : [aggErr instanceof Error ? aggErr.message : String(aggErr)];
    throw new Error(`All Overpass mirrors failed: ${errors.join(' | ')}`);
  }
}

export type OverpassFetchResult = {
  result: OverpassResponse;
  fellBack: boolean;
  totalMs: number;
  primaryError?: string;
  fallbackError?: string;
};

const EMPTY_OVERPASS: OverpassResponse = {
  amenities: [],
  buildings: [],
  transit: [],
  landuse: [],
  rawCount: 0,
};

export async function fetchOverpassWithFallback(
  center: LatLon,
  radiusMeters: number = CONFIG.overpass.defaultRadius,
): Promise<OverpassFetchResult> {
  const t0 = Date.now();
  let primaryTimer: ReturnType<typeof setTimeout> | undefined;
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
  const primary = new Promise<OverpassResponse>((resolve, reject) => {
    primaryTimer = setTimeout(
      () => reject(new Error(`primary timeout ${PRIMARY_TIMEOUT_MS}ms`)),
      PRIMARY_TIMEOUT_MS,
    );
    fetchOverpass(center, radiusMeters).then(
      (v) => resolve(v),
      (e) => reject(e instanceof Error ? e : new Error(String(e))),
    );
  });
  try {
    const result = await primary;
    if (primaryTimer) clearTimeout(primaryTimer);
    return { result, fellBack: false, totalMs: Date.now() - t0 };
  } catch (primaryError) {
    if (primaryTimer) clearTimeout(primaryTimer);
    const primaryMsg =
      primaryError instanceof Error ? primaryError.message : String(primaryError);
    const fallbackRadius = Math.min(FALLBACK_RADIUS, radiusMeters);
    const fallback = new Promise<OverpassResponse>((resolve, reject) => {
      fallbackTimer = setTimeout(
        () => reject(new Error(`fallback timeout ${FALLBACK_TIMEOUT_MS}ms`)),
        FALLBACK_TIMEOUT_MS,
      );
      fetchOverpass(center, fallbackRadius).then(
        (v) => resolve(v),
        (e) => reject(e instanceof Error ? e : new Error(String(e))),
      );
    });
    try {
      const result = await fallback;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      return {
        result,
        fellBack: true,
        totalMs: Date.now() - t0,
        primaryError: primaryMsg,
      };
    } catch (fallbackError) {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      const fallbackMsg =
        fallbackError instanceof Error
          ? fallbackError.message
          : String(fallbackError);
      return {
        result: EMPTY_OVERPASS,
        fellBack: true,
        totalMs: Date.now() - t0,
        primaryError: primaryMsg,
        fallbackError: fallbackMsg,
      };
    }
  }
}
