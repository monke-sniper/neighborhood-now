export const CONFIG = {
  overpass: {
    url: 'https://overpass-api.de/api/interpreter',
    mirrors: [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
    ],
    radiusMeters: 1500,
    timeoutSec: 25,
    userAgent: 'NeighborhoodNow/1.0 (hackathon; contact: hello@neighborhood.now)',
  },
  builddata: {
    url: 'https://api.builddata.ca/permit/export',
    municipality: 'toronto',
    radiusMeters: 1500,
  },
  nominatim: {
    url: 'https://nominatim.openstreetmap.org/search',
    userAgent: 'NeighborhoodNow/1.0 (hackathon)',
    limit: 1,
  },
  complaints: {
    file: 'data/toronto-311.json',
    radiusMeters: 1500,
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
    amenityDensity: 0.25,
    transitScore: 0.25,
    foodAccess: 0.2,
    greenSpace: 0.15,
    development: 0.15,
  },
} as const;
