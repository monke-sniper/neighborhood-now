import type { LatLon } from '../types';

export interface CensusDemographics {
  medianIncome: number;
  population: number;
}

function isInUS(coords: LatLon): boolean {
  return (
    coords.lat >= 24 &&
    coords.lat <= 50 &&
    coords.lon >= -125 &&
    coords.lon <= -66
  );
}

export async function fetchCensus(
  coords: LatLon,
  apiKey?: string,
): Promise<CensusDemographics | null> {
  const key = apiKey ?? process.env.CENSUS_KEY ?? '';
  if (!key) return null;
  if (!isInUS(coords)) return null;
  return null;
}
