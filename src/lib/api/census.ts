import type { LatLon } from '../types';

export interface CensusDemographics {
  medianIncome: number;
  population: number;
}

const CENSUS_KEY = process.env.CENSUS_KEY ?? '';

function isInUS(coords: LatLon): boolean {
  return (
    coords.lat >= 24 &&
    coords.lat <= 50 &&
    coords.lon >= -125 &&
    coords.lon <= -66
  );
}

export async function fetchCensus(coords: LatLon): Promise<CensusDemographics | null> {
  if (!CENSUS_KEY) return null;
  if (!isInUS(coords)) return null;
  return null;
}
