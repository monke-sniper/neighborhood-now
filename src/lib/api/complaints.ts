import { TTLCache } from '../utils/cache';
import { filterByRadius } from '../utils/geo';
import { CONFIG } from '../config';
import { log } from '../logger';
import type { Complaint, LatLon } from '../types';

const cache = new TTLCache<string, Complaint[]>();
const CACHE_KEY = 'toronto-311-combined';

const SOURCES: string[] = [
  CONFIG.complaints.url,
  '/data/toronto-311-citywide.json',
];

interface CkanSearchResponse {
  success?: boolean;
  result?: {
    records?: Array<Record<string, unknown>>;
  };
}

function normalize(c: Record<string, unknown>): Complaint | null {
  const lat = Number(c.lat ?? c.LATITUDE ?? c.latitude);
  const lon = Number(c.lon ?? c.LONGITUDE ?? c.longitude ?? c.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const type = String(
    c.type ?? c.SERVICE_NAME ?? c.service_type ?? c.SUBJECT ?? 'Other',
  );
  const date = String(
    c.date ?? c.CREATED_DATE ?? c.created_date ?? c.EVENT_DATE ?? '',
  );
  const status = String(
    c.status ?? c.STATUS ?? c.SERVICE_REQUEST_STATUS ?? 'Unknown',
  );
  const id = String(
    c.id ?? c._id ?? c.SERVICE_REQUEST_ID ?? `${lat},${lon},${date},${Math.random()}`,
  );
  return { id, type, date, lat, lon, status };
}

async function loadFromStatic(): Promise<Complaint[]> {
  const out: Complaint[] = [];
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        log.warn('complaints.static_failed', { url, status: res.status });
        continue;
      }
      const data = (await res.json()) as unknown;
      if (Array.isArray(data)) {
        for (const r of data) {
          const c = normalize(r as Record<string, unknown>);
          if (c) out.push(c);
        }
      }
    } catch (e) {
      log.warn('complaints.static_error', {
        url,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return out;
}

async function loadFromCkan(): Promise<Complaint[] | null> {
  const resourceId = process.env.TORONTO_311_RESOURCE_ID;
  if (!resourceId) return null;
  const base = 'https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action';
  try {
    const url = `${base}/datastore_search?resource_id=${encodeURIComponent(resourceId)}&limit=5000`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      log.warn('complaints.ckan_failed', { status: res.status });
      return null;
    }
    const data = (await res.json()) as CkanSearchResponse;
    const records = data.result?.records ?? [];
    const out: Complaint[] = [];
    for (const r of records) {
      const c = normalize(r);
      if (c) out.push(c);
    }
    return out;
  } catch (e) {
    log.warn('complaints.ckan_error', {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

async function loadAll(): Promise<Complaint[]> {
  const hit = cache.get(CACHE_KEY);
  if (hit) return hit;
  const staticList = await loadFromStatic();
  const ckanList = await loadFromCkan();
  const merged = ckanList && ckanList.length > 0 ? ckanList : staticList;
  cache.set(CACHE_KEY, merged, 1000 * 60 * 60 * 24);
  log.info('complaints.loaded', {
    count: merged.length,
    source: ckanList && ckanList.length > 0 ? 'ckan' : 'static',
  });
  return merged;
}

export async function fetchComplaints(
  center: LatLon,
  radiusMeters: number = CONFIG.complaints.defaultRadius,
): Promise<Complaint[]> {
  try {
    const all = await loadAll();
    return filterByRadius(all, center, radiusMeters);
  } catch (e) {
    log.warn('complaints.failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}
