import { TTLCache } from '../utils/cache';
import { CONFIG } from '../config';
import type { GeocodeResult } from '../types';

export class GeocodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeocodeError';
  }
}

const cache = new TTLCache<string, GeocodeResult>();

const MIN_INTERVAL_MS = 1100;
let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

interface NominatimRaw {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ');
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    lastRequestAt = Date.now();
    return task();
  });
  queue = next.catch(() => undefined);
  return next;
}

export async function geocode(address: string): Promise<GeocodeResult> {
  const key = normalizeAddress(address);
  if (!key) throw new GeocodeError('Empty address');

  const cached = cache.get(key);
  if (cached) return cached;

  return enqueue(async () => {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: String(CONFIG.nominatim.limit),
    });
    const url = `${CONFIG.nominatim.url}?${params.toString()}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': CONFIG.nominatim.userAgent },
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new GeocodeError(`Nominatim HTTP ${res.status}`);
    }
    const data = (await res.json()) as NominatimRaw[];
    if (!Array.isArray(data) || data.length === 0) {
      throw new GeocodeError(`No results for "${address}"`);
    }
    const first = data[0]!;
    const result: GeocodeResult = {
      lat: parseFloat(first.lat),
      lon: parseFloat(first.lon),
      displayName: first.display_name,
    };
    if (first.boundingbox) {
      const bb = first.boundingbox;
      result.bbox = [
        parseFloat(bb[2]),
        parseFloat(bb[0]),
        parseFloat(bb[3]),
        parseFloat(bb[1]),
      ];
    }
    cache.set(key, result, CONFIG.cache.geocodeTtlMs);
    return result;
  });
}
