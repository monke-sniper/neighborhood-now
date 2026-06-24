import { CONFIG } from '../config';
import type {
  Amenity,
  LivabilityScore,
  Permit,
  ScoreBreakdown,
} from '../types';

const AREA_KM2 = (CONFIG.overpass.radiusMeters / 1000) ** 2 * Math.PI;

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export function computeBreakdown(
  amenities: Amenity[],
  permits: Permit[],
): ScoreBreakdown {
  const restaurants = amenities.filter((a) => a.kind === 'restaurant').length;
  const cafes = amenities.filter((a) => a.kind === 'cafe').length;
  const schools = amenities.filter((a) => a.kind === 'school').length;
  const groceries = amenities.filter((a) => a.kind === 'grocery').length;
  const parks = amenities.filter((a) => a.kind === 'park').length;
  const transitCount = amenities.filter(
    (a) => a.kind === 'bus_stop' || a.kind === 'transit',
  ).length;
  const buildings = amenities.filter((a) => a.kind === 'construction').length;
  const landuse = amenities.filter((a) => a.tags?.landuse === 'park').length;

  const amenityPerKm2 = (restaurants + cafes + schools) / AREA_KM2;
  const transitPerKm2 = transitCount / AREA_KM2;

  const amenityDensity = clamp((amenityPerKm2 / 80) * 100);
  const transitScore = clamp((transitPerKm2 / 40) * 100);

  let foodAccess: number;
  if (groceries === 0) foodAccess = 15;
  else if (groceries === 1) foodAccess = 45;
  else if (groceries === 2) foodAccess = 70;
  else foodAccess = 95;

  const greenNumerator = parks + landuse * 2;
  const greenDenominator = greenNumerator + buildings * 0.5;
  const greenSpace = clamp(
    greenDenominator > 0 ? (greenNumerator / greenDenominator) * 100 : 35,
  );

  const now = Date.now();
  const sixMonthsMs = 1000 * 60 * 60 * 24 * 30 * 6;
  const recentPermits = permits.filter((p) => {
    const t = Date.parse(p.issuedDate);
    return Number.isFinite(t) && now - t <= sixMonthsMs;
  }).length;

  let development: number;
  if (recentPermits === 0) development = 30;
  else if (recentPermits <= 3) development = 60;
  else if (recentPermits <= 8) development = 85;
  else if (recentPermits <= 15) development = 70;
  else development = 45;

  return {
    amenityDensity: Math.round(amenityDensity),
    transitScore: Math.round(transitScore),
    foodAccess: Math.round(foodAccess),
    greenSpace: Math.round(greenSpace),
    development: Math.round(development),
  };
}

export function computeTotal(breakdown: ScoreBreakdown): LivabilityScore {
  const w = CONFIG.weights;
  const total =
    breakdown.amenityDensity * w.amenityDensity +
    breakdown.transitScore * w.transitScore +
    breakdown.foodAccess * w.foodAccess +
    breakdown.greenSpace * w.greenSpace +
    breakdown.development * w.development;
  return {
    total: Math.round(clamp(total)),
    breakdown,
    cityAverage: 60,
  };
}
