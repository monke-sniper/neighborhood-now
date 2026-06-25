import { CONFIG } from '../config';
import { BENCHMARKS, scaleBench, type BenchKey } from './benchmarks';
import type {
  Amenity,
  LivabilityScore,
  Permit,
  Ranking,
  ScoreBreakdown,
} from '../types';

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;
const NEUTRAL = 50;

function clamp01(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function percentileScore(
  actual: number,
  p10: number,
  p90: number,
  invert: boolean,
): number {
  if (p90 <= p10) {
    return NEUTRAL;
  }
  const raw = ((actual - p10) / (p90 - p10)) * 100;
  const clamped = clamp01(raw);
  return invert ? 100 - clamped : clamped;
}

function countKinds(amenities: Amenity[], kinds: string[]): number {
  let n = 0;
  for (const a of amenities) {
    if (kinds.includes(a.kind)) n++;
  }
  return n;
}

function safeRound(n: number): number {
  return Math.round(clamp01(n));
}

function pickBench(key: BenchKey, radiusMeters: number) {
  const m = BENCHMARKS.metrics[key];
  return scaleBench(m, radiusMeters);
}

export function computeBreakdown(
  amenities: Amenity[],
  permits: Permit[],
  radiusMeters: number = 1500,
): ScoreBreakdown {
  const restaurants = countKinds(amenities, ['restaurant']);
  const cafes = countKinds(amenities, ['cafe']);
  const schools = countKinds(amenities, ['school']);
  const groceries = countKinds(amenities, ['grocery']);
  const parks = countKinds(amenities, ['park']);
  const transit = countKinds(amenities, ['bus_stop', 'transit']);
  const construction = countKinds(amenities, ['construction']);
  const civic = countKinds(amenities, ['civic']);
  const culture = countKinds(amenities, ['culture']);
  const recreation = countKinds(amenities, ['recreation']);
  const service = countKinds(amenities, ['service']);

  const now = Date.now();
  const recentPermits = permits.filter((p) => {
    const t = Date.parse(p.issuedDate);
    return Number.isFinite(t) && now - t <= SIX_MONTHS_MS;
  }).length;

  const b = {
    restaurant: pickBench('restaurant', radiusMeters),
    cafe: pickBench('cafe', radiusMeters),
    school: pickBench('school', radiusMeters),
    grocery: pickBench('grocery', radiusMeters),
    park: pickBench('park', radiusMeters),
    transit: pickBench('transit', radiusMeters),
    construction: pickBench('construction', radiusMeters),
    permits: pickBench('permits500m', radiusMeters),
    civic: pickBench('civic', radiusMeters),
    culture: pickBench('culture', radiusMeters),
    recreation: pickBench('recreation', radiusMeters),
    service: pickBench('service', radiusMeters),
  };

  const amenityMix = restaurants + cafes + schools;
  const amenityP10 = b.restaurant.p10 + b.cafe.p10 + b.school.p10;
  const amenityP90 = b.restaurant.p90 + b.cafe.p90 + b.school.p90;
  const amenityDensity = safeRound(
    percentileScore(amenityMix, amenityP10, amenityP90, false),
  );

  const transitScore = safeRound(
    percentileScore(transit, b.transit.p10, b.transit.p90, false),
  );

  const foodAccess = safeRound(
    percentileScore(groceries, b.grocery.p10, b.grocery.p90, false),
  );

  const greenBase = safeRound(
    percentileScore(parks, b.park.p10, b.park.p90, false),
  );
  const greenFloor = parks === 0 ? 15 : parks <= 2 ? 35 : 0;
  const greenSpace = safeRound(Math.max(greenBase, greenFloor));

  let development: number;
  if (b.permits.p90 > b.permits.p10) {
    const permitsScore = percentileScore(
      recentPermits,
      b.permits.p10,
      b.permits.p90,
      false,
    );
    const constructionScore = percentileScore(
      construction,
      b.construction.p10,
      b.construction.p90,
      false,
    );
    development = safeRound(permitsScore * 0.6 + constructionScore * 0.4);
  } else {
    development = safeRound(
      percentileScore(construction, b.construction.p10, b.construction.p90, false),
    );
    if (development === NEUTRAL && construction === 0) {
      development = 45;
    }
  }

  const civicScore = safeRound(
    percentileScore(civic, b.civic.p10, b.civic.p90, false),
  );
  const cultureScore = safeRound(
    percentileScore(culture, b.culture.p10, b.culture.p90, false),
  );
  const recreationScore = safeRound(
    percentileScore(recreation, b.recreation.p10, b.recreation.p90, false),
  );
  const serviceScore = safeRound(
    percentileScore(service, b.service.p10, b.service.p90, false),
  );

  return {
    amenityDensity,
    transitScore,
    foodAccess,
    greenSpace,
    development,
    civicScore,
    cultureScore,
    recreationScore,
    serviceScore,
  };
}

export function computeTotal(breakdown: ScoreBreakdown): LivabilityScore {
  const w = CONFIG.weights;
  const total =
    breakdown.amenityDensity * w.amenityDensity +
    breakdown.transitScore * w.transitScore +
    breakdown.foodAccess * w.foodAccess +
    breakdown.greenSpace * w.greenSpace +
    breakdown.development * w.development +
    breakdown.civicScore * w.civicScore +
    breakdown.cultureScore * w.cultureScore +
    breakdown.recreationScore * w.recreationScore +
    breakdown.serviceScore * w.serviceScore;
  const totalClamped = Math.round(clamp01(total));
  return {
    total: totalClamped,
    breakdown,
    cityAverage: NEUTRAL,
    ranking: computeRanking(totalClamped),
  };
}

export function computeRanking(score: number): Ranking {
  const s = clamp01(score);
  let label: string;
  if (s >= 90) label = 'Top 10%';
  else if (s >= 75) label = 'Top 25%';
  else if (s >= 60) label = 'Above average';
  else if (s >= 40) label = 'Average';
  else if (s >= 25) label = 'Below average';
  else label = 'Bottom 25%';
  return { percentile: Math.round(s), label };
}
