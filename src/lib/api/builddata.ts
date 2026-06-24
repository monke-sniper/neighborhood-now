import { TTLCache } from '../utils/cache';
import { CONFIG } from '../config';
import { filterByRadius } from '../utils/geo';
import type { LatLon, Permit } from '../types';

interface BuildDataRaw {
  id?: string | number;
  lat?: number;
  lng?: number;
  address?: string;
  description?: string;
  issued_date?: string;
  structure_type?: string;
  construction_value?: number;
  status?: string;
}

interface BuildDataResponse {
  count?: number;
  results?: BuildDataRaw[];
}

const cache = new TTLCache<string, Permit[]>();
const CACHE_KEY = 'toronto-permits';

function toPermit(r: BuildDataRaw, index: number): Permit | null {
  if (typeof r.lat !== 'number' || typeof r.lng !== 'number') return null;
  return {
    id: String(r.id ?? `${r.address ?? 'permit'}-${index}`),
    address: r.address ?? '',
    lat: r.lat,
    lon: r.lng,
    description: r.description ?? '',
    issuedDate: r.issued_date ?? '',
    structureType: r.structure_type ?? '',
    constructionValue: r.construction_value,
    status: r.status ?? '',
  };
}

export async function fetchPermits(center: LatLon): Promise<Permit[]> {
  let all = cache.get(CACHE_KEY);
  if (!all) {
    const url = `${CONFIG.builddata.url}?format=json&municipality=${CONFIG.builddata.municipality}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`BuildData HTTP ${res.status}`);
    }
    const data = (await res.json()) as BuildDataResponse;
    const raw = Array.isArray(data.results) ? data.results : [];
    all = raw
      .map((r, i) => toPermit(r, i))
      .filter((p): p is Permit => p !== null);
    cache.set(CACHE_KEY, all, CONFIG.cache.builddataTtlMs);
  }
  return filterByRadius(all, center, CONFIG.builddata.radiusMeters);
}
