import { CONFIG } from '../config';
import { BENCHMARKS, scaleBench, type BenchKey } from './benchmarks';
import { computeTotalFromBreakdown } from './score.total';
import {
  ALL_PRESENT,
  type DataPresence,
  type WeightSet,
} from './score.types';
import { haversineMeters } from '../utils/geo';
import { hasRealName, pickName } from '../utils/amenity';
import type {
  Amenity,
  LatLon,
  LivabilityScore,
  Permit,
  Ranking,
  SchoolImpact,
  ScoreBreakdown,
} from '../types';

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;
const NEUTRAL = 50;
const NO_CONSTRUCTION_FLOOR = 45;

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

export type { DataPresence, WeightSet } from './score.types';
export { ALL_PRESENT, ALL_ABSENT } from './score.types';

export interface ComputeBreakdownResult {
  breakdown: ScoreBreakdown;
  presence: DataPresence;
  counts: {
    restaurants: number;
    cafes: number;
    schools: number;
    groceries: number;
    parks: number;
    transit: number;
    construction: number;
    civic: number;
    culture: number;
    recreation: number;
    service: number;
    recentPermits: number;
  };
}

export function computeBreakdown(
  amenities: Amenity[],
  permits: Permit[],
  radiusMeters: number = 1500,
  opts: { nowMs?: number } = {},
): ComputeBreakdownResult {
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

  const now = opts.nowMs ?? Date.now();
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
  const greenFloor = parks === 0 ? 10 : parks === 1 ? 20 : 0;
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
      development = NO_CONSTRUCTION_FLOOR;
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

  const breakdown: ScoreBreakdown = {
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

  const presence: DataPresence = {
    amenityDensity: restaurants + cafes + schools > 0,
    transitScore: transit > 0,
    foodAccess: groceries > 0,
    greenSpace: parks > 0,
    development: recentPermits > 0 || construction > 0,
    civicScore: civic > 0,
    cultureScore: culture > 0,
    recreationScore: recreation > 0,
    serviceScore: service > 0,
  };

  const counts = {
    restaurants,
    cafes,
    schools,
    groceries,
    parks,
    transit,
    construction,
    civic,
    culture,
    recreation,
    service,
    recentPermits,
  };

  return { breakdown, presence, counts };
}

export interface ComputeTotalOptions {
  presence?: DataPresence;
  weights?: WeightSet;
}

export function computeTotal(
  breakdown: ScoreBreakdown,
  options: ComputeTotalOptions = {},
): LivabilityScore {
  const w = options.weights ?? (CONFIG.weights as WeightSet);
  const presence: DataPresence = options.presence ?? ALL_PRESENT;
  const { total, maxPossible } = computeTotalFromBreakdown(breakdown, presence, w);
  return {
    total,
    maxPossible,
    breakdown,
    presence,
    cityAverage: NEUTRAL,
    ranking: computeRanking(total),
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

export interface SchoolAnalysis {
  impacts: SchoolImpact[];
  baseTotal: number;
}

export function analyzeSchools(
  amenities: Amenity[],
  permits: Permit[],
  radiusMeters: number,
  center: LatLon,
  options: { nowMs?: number } = {},
): SchoolAnalysis {
  const schools = amenities.filter((a) => a.kind === 'school');
  if (schools.length === 0) {
    return { impacts: [], baseTotal: 0 };
  }
  const computed = computeBreakdown(amenities, permits, radiusMeters, {
    nowMs: options.nowMs,
  });
  const w = CONFIG.weights as WeightSet;
  const presentKeys = (Object.keys(computed.presence) as (keyof ScoreBreakdown)[])
    .filter((k) => computed.presence[k]);
  const totalWeight = presentKeys.reduce((s, k) => s + w[k], 0);
  const baseTotal = computeTotalFromBreakdown(
    computed.breakdown,
    computed.presence,
    w,
  ).total;

  const bR = pickBench('restaurant', radiusMeters);
  const bC = pickBench('cafe', radiusMeters);
  const bS = pickBench('school', radiusMeters);
  const amenityP10 = bR.p10 + bC.p10 + bS.p10;
  const amenityP90 = bR.p90 + bC.p90 + bS.p90;

  const restaurants = countKinds(amenities, ['restaurant']);
  const cafes = countKinds(amenities, ['cafe']);
  const schoolCount = countKinds(amenities, ['school']);
  const currentMix = restaurants + cafes + schoolCount;

  const impacts: SchoolImpact[] = schools.map((s) => {
    const altMix = currentMix - 1;
    const altDensity = safeRound(
      percentileScore(altMix, amenityP10, amenityP90, false),
    );
    const wAmenity = w.amenityDensity;
    const deltaNum = (computed.breakdown.amenityDensity - altDensity) * wAmenity;
    const delta = Math.round((deltaNum * 100) / Math.max(0.0001, totalWeight));
    return {
      id: s.id,
      name: pickName(s),
      distanceKm: haversineMeters(s, center) / 1000,
      delta,
      hasName: hasRealName(s),
    };
  });

  impacts.sort((a, b) => b.delta - a.delta || a.distanceKm - b.distanceKm);
  return { impacts, baseTotal };
}
