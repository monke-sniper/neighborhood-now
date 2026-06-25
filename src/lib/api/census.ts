import { httpJson } from '../http';
import { log } from '../logger';
import { UpstreamError } from '../errors';
import type { LatLon } from '../types';

export interface CensusDemographics {
  medianIncome: number;
  population: number;
}

interface StateBox {
  abbr: string;
  fips: string;
  bbox: [number, number, number, number];
  counties: Array<{
    name: string;
    fips: string;
    bbox: [number, number, number, number];
  }>;
}

const STATE_BOXES: StateBox[] = [
  {
    abbr: 'NY',
    fips: '36',
    bbox: [40.477, -79.762, 45.015, -71.777],
    counties: [
      { name: 'New York', fips: '061', bbox: [40.516, -74.047, 40.879, -73.700] },
      { name: 'Kings (Brooklyn)', fips: '047', bbox: [40.566, -74.047, 40.739, -73.833] },
      { name: 'Queens', fips: '081', bbox: [40.541, -73.962, 40.800, -73.700] },
      { name: 'Bronx', fips: '005', bbox: [40.785, -73.933, 40.915, -73.748] },
      { name: 'Erie (Buffalo)', fips: '029', bbox: [42.731, -78.910, 43.105, -78.466] },
    ],
  },
  {
    abbr: 'CA',
    fips: '06',
    bbox: [32.529, -124.482, 42.009, -114.131],
    counties: [
      { name: 'San Francisco', fips: '075', bbox: [37.703, -123.001, 37.832, -122.357] },
      { name: 'Los Angeles', fips: '037', bbox: [33.701, -118.668, 34.823, -117.646] },
      { name: 'San Diego', fips: '073', bbox: [32.529, -117.281, 33.505, -116.081] },
      { name: 'Alameda (Oakland)', fips: '001', bbox: [37.435, -122.336, 37.906, -121.469] },
      { name: 'Santa Clara (San Jose)', fips: '085', bbox: [36.893, -121.939, 37.484, -121.208] },
    ],
  },
  {
    abbr: 'IL',
    fips: '17',
    bbox: [36.970, -91.513, 42.508, -87.020],
    counties: [
      { name: 'Cook (Chicago)', fips: '031', bbox: [41.469, -88.263, 42.154, -87.111] },
    ],
  },
  {
    abbr: 'MA',
    fips: '25',
    bbox: [41.237, -73.508, 42.886, -69.858],
    counties: [
      { name: 'Suffolk (Boston)', fips: '025', bbox: [42.227, -71.181, 42.396, -70.984] },
      { name: 'Middlesex', fips: '017', bbox: [42.156, -71.899, 42.736, -71.020] },
    ],
  },
  {
    abbr: 'WA',
    fips: '53',
    bbox: [45.543, -124.836, 49.002, -116.915],
    counties: [
      { name: 'King (Seattle)', fips: '033', bbox: [47.084, -122.530, 47.776, -121.067] },
    ],
  },
  {
    abbr: 'TX',
    fips: '48',
    bbox: [25.837, -106.646, 36.500, -93.508],
    counties: [
      { name: 'Harris (Houston)', fips: '201', bbox: [29.497, -95.961, 30.170, -94.910] },
      { name: 'Travis (Austin)', fips: '453', bbox: [30.039, -98.173, 30.628, -97.382] },
      { name: 'Dallas', fips: '113', bbox: [32.560, -97.039, 33.020, -96.516] },
    ],
  },
  {
    abbr: 'PA',
    fips: '42',
    bbox: [39.719, -80.519, 42.269, -74.690],
    counties: [
      { name: 'Philadelphia', fips: '101', bbox: [39.867, -75.281, 40.138, -74.955] },
      { name: 'Allegheny (Pittsburgh)', fips: '003', bbox: [40.194, -80.336, 40.674, -79.690] },
    ],
  },
  {
    abbr: 'GA',
    fips: '13',
    bbox: [30.356, -85.605, 35.001, -80.840],
    counties: [
      { name: 'Fulton (Atlanta)', fips: '121', bbox: [33.621, -84.839, 34.166, -84.272] },
    ],
  },
  {
    abbr: 'FL',
    fips: '12',
    bbox: [24.396, -87.635, 31.001, -79.974],
    counties: [
      { name: 'Miami-Dade', fips: '086', bbox: [25.137, -80.873, 25.978, -80.116] },
      { name: 'Orange (Orlando)', fips: '095', bbox: [28.347, -81.659, 28.797, -81.234] },
    ],
  },
  {
    abbr: 'CO',
    fips: '08',
    bbox: [36.993, -109.060, 41.003, -102.041],
    counties: [
      { name: 'Denver', fips: '031', bbox: [39.614, -105.110, 39.914, -104.600] },
    ],
  },
];

function inBbox(lat: number, lon: number, b: [number, number, number, number]): boolean {
  return lat >= b[0] && lat <= b[2] && lon >= b[1] && lon <= b[3];
}

function lookupFips(coords: LatLon): { stateFips: string; countyFips: string } | null {
  for (const s of STATE_BOXES) {
    if (!inBbox(coords.lat, coords.lon, s.bbox)) continue;
    for (const c of s.counties) {
      if (inBbox(coords.lat, coords.lon, c.bbox)) {
        return { stateFips: s.fips, countyFips: c.fips };
      }
    }
    return { stateFips: s.fips, countyFips: s.counties[0]?.fips ?? '000' };
  }
  return null;
}

interface CensusResponse {
  result?: string[][];
}

export async function fetchCensus(
  coords: LatLon,
  apiKey?: string,
): Promise<CensusDemographics | null> {
  const key = apiKey ?? process.env.CENSUS_KEY ?? '';
  if (!key) return null;
  const fips = lookupFips(coords);
  if (!fips) return null;
  const url =
    `https://api.census.gov/data/2023/acs/acs5?get=NAME,B19013_001E,B01003_001E` +
    `&for=tract:*&in=state:${fips.stateFips}&in=county:${fips.countyFips}` +
    `&key=${key}`;
  try {
    const data = await httpJson<CensusResponse>(url, {
      source: 'census',
      timeoutMs: 8000,
    });
    if (!data.result || data.result.length < 2) return null;
    const header = data.result[0];
    const rows = data.result.slice(1);
    const incomeIdx = header.indexOf('B19013_001E');
    const popIdx = header.indexOf('B01003_001E');
    if (incomeIdx < 0 || popIdx < 0) return null;
    const incomes: number[] = [];
    let population = 0;
    for (const row of rows) {
      const income = Number(row[incomeIdx]);
      const pop = Number(row[popIdx]);
      if (Number.isFinite(income) && income > 0) incomes.push(income);
      if (Number.isFinite(pop)) population += pop;
    }
    if (incomes.length === 0) return null;
    incomes.sort((a, b) => a - b);
    const median = incomes[Math.floor(incomes.length / 2)] ?? 0;
    return { medianIncome: median, population };
  } catch (e) {
    if (e instanceof UpstreamError) {
      log.warn('census.failed', { status: e.status, message: e.message });
    } else {
      log.warn('census.error', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
    return null;
  }
}
