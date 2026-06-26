export const ALLOWED_RADII_M = [1000, 2000, 3000, 5000] as const;
export type AllowedRadius = (typeof ALLOWED_RADII_M)[number];

export function parseRadius(raw: string | null | undefined): AllowedRadius {
  const n = Number(raw);
  if (ALLOWED_RADII_M.includes(n as AllowedRadius)) return n as AllowedRadius;
  return 3000;
}

export const CONFIG = {
  overpass: {
    url: 'https://overpass-api.de/api/interpreter',
    mirrors: [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
    ],
    defaultRadius: 3000,
    timeoutSec: 25,
    userAgent: 'NeighborhoodNow/1.0 (contact: hello@neighborhood.now)',
  },
  builddata: {
    url: 'https://api.builddata.ca/permit/export',
    municipality: 'toronto',
    defaultRadius: 3000,
  },
  nominatim: {
    url: 'https://nominatim.openstreetmap.org/search',
    userAgent: 'NeighborhoodNow/1.0',
    limit: 1,
  },
  complaints: {
    file: 'data/toronto-311.json',
    url: '/data/toronto-311.json',
    defaultRadius: 3000,
  },
  census: {
    base: 'https://api.census.gov/data/2023/acs/acs5',
  },
  openweather: {
    base: 'https://api.openweathermap.org/data/2.5',
  },
  cache: {
    geocodeTtlMs: 1000 * 60 * 60 * 24,
    reportTtlMs: 1000 * 60 * 5,
    builddataTtlMs: 1000 * 60 * 60,
  },
  weights: {
    amenityDensity: 0.18,
    transitScore: 0.18,
    foodAccess: 0.14,
    greenSpace: 0.10,
    development: 0.10,
    civicScore: 0.075,
    cultureScore: 0.075,
    recreationScore: 0.075,
    serviceScore: 0.075,
  },
} as const;
