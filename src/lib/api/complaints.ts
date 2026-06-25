import { TTLCache } from '../utils/cache';
import { filterByRadius } from '../utils/geo';
import { CONFIG } from '../config';
import type { Complaint, LatLon } from '../types';

const cache = new TTLCache<string, Complaint[]>();
const CACHE_KEY = 'toronto-311';

async function loadAll(): Promise<Complaint[]> {
  const hit = cache.get(CACHE_KEY);
  if (hit) return hit;
  const res = await fetch(CONFIG.complaints.url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`311 file HTTP ${res.status}`);
  }
  const data = (await res.json()) as Complaint[];
  const list = Array.isArray(data) ? data : [];
  cache.set(CACHE_KEY, list, 1000 * 60 * 60);
  return list;
}

export async function fetchComplaints(
  center: LatLon,
  radiusMeters: number = CONFIG.complaints.defaultRadius,
): Promise<Complaint[]> {
  try {
    const all = await loadAll();
    return filterByRadius(all, center, radiusMeters);
  } catch {
    return [];
  }
}
