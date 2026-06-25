import { BENCHMARKS, scaleBench, type BenchKey } from './benchmarks';
import { CONFIG } from '../config';
import type {
  Amenity,
  LivabilityScore,
  Permit,
  ScoreBreakdown,
} from '../types';

export type Tier = 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'LOW' | 'MINIMAL';
export type PercentileLabel =
  | 'Top 10%'
  | 'Top 25%'
  | 'Above average'
  | 'Average'
  | 'Below average'
  | 'Bottom 25%';

export interface ScoreExplanation {
  key: keyof ScoreBreakdown;
  label: string;
  count: number;
  countBreakdown?: Record<string, number>;
  benchmark: { p10: number; p50: number; p90: number };
  score: number;
  tier: Tier;
  percentile: PercentileLabel;
  weight: number;
  contribution: number;
  maxContribution: number;
  sentence: string;
}

const LABELS: Record<keyof ScoreBreakdown, string> = {
  amenityDensity: 'AMENITY DENSITY',
  transitScore: 'TRANSIT ACCESS',
  foodAccess: 'FOOD ACCESS',
  greenSpace: 'GREEN SPACE',
  development: 'DEVELOPMENT',
  civicScore: 'CIVIC',
  cultureScore: 'CULTURE',
  recreationScore: 'RECREATION',
  serviceScore: 'SERVICES',
};

const COMPONENT_TO_BENCH: Record<keyof ScoreBreakdown, BenchKey> = {
  amenityDensity: 'restaurant',
  transitScore: 'transit',
  foodAccess: 'grocery',
  greenSpace: 'park',
  development: 'construction',
  civicScore: 'civic',
  cultureScore: 'culture',
  recreationScore: 'recreation',
  serviceScore: 'service',
};

export function tierFor(score: number): Tier {
  if (score >= 75) return 'EXCELLENT';
  if (score >= 60) return 'GOOD';
  if (score >= 40) return 'AVERAGE';
  if (score >= 25) return 'LOW';
  return 'MINIMAL';
}

function percentileFor(score: number): PercentileLabel {
  if (score >= 90) return 'Top 10%';
  if (score >= 75) return 'Top 25%';
  if (score >= 60) return 'Above average';
  if (score >= 40) return 'Average';
  if (score >= 25) return 'Below average';
  return 'Bottom 25%';
}

function countByKind(amenities: Amenity[], kinds: string[]): number {
  let n = 0;
  for (const a of amenities) {
    if (kinds.includes(a.kind)) n++;
  }
  return n;
}

function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

function countBreakdown(
  key: keyof ScoreBreakdown,
  amenities: Amenity[],
  permits: Permit[],
): Record<string, number> {
  switch (key) {
    case 'amenityDensity':
      return {
        restaurants: countByKind(amenities, ['restaurant']),
        cafes: countByKind(amenities, ['cafe']),
        schools: countByKind(amenities, ['school']),
      };
    case 'transitScore':
      return {
        bus_stops: countByKind(amenities, ['bus_stop']),
        stations: countByKind(amenities, ['transit']),
      };
    case 'foodAccess':
      return { grocery_stores: countByKind(amenities, ['grocery']) };
    case 'greenSpace':
      return { parks: countByKind(amenities, ['park']) };
    case 'development': {
      const now = Date.now();
      const sixMonthsMs = 1000 * 60 * 60 * 24 * 30 * 6;
      const recent = permits.filter((p) => {
        const t = Date.parse(p.issuedDate);
        return Number.isFinite(t) && now - t <= sixMonthsMs;
      }).length;
      return {
        recent_permits: recent,
        construction_sites: countByKind(amenities, ['construction']),
      };
    }
    case 'civicScore':
      return { civic_sites: countByKind(amenities, ['civic']) };
    case 'cultureScore':
      return { cultural_venues: countByKind(amenities, ['culture']) };
    case 'recreationScore':
      return { rec_sites: countByKind(amenities, ['recreation']) };
    case 'serviceScore':
      return { service_businesses: countByKind(amenities, ['service']) };
  }
}

function totalCount(breakdown: Record<string, number>): number {
  let n = 0;
  for (const v of Object.values(breakdown)) n += v;
  return n;
}

function countSentence(
  key: keyof ScoreBreakdown,
  total: number,
  parts: Record<string, number>,
): string {
  const detail = Object.entries(parts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${fmtInt(v)} ${k.replace(/_/g, ' ')}`)
    .join(' + ');
  const base = `${fmtInt(total)} ${LABELS[key].toLowerCase()}`;
  return detail ? `${base} (${detail})` : base;
}

function buildSentence(
  key: keyof ScoreBreakdown,
  total: number,
  parts: Record<string, number>,
  tier: Tier,
  percentile: PercentileLabel,
  contribution: number,
  maxContribution: number,
  benchmark: { p10: number; p90: number },
): string {
  const head = countSentence(key, total, parts);
  const tierPhrase =
    tier === 'EXCELLENT' || tier === 'GOOD'
      ? `${tier.toLowerCase()} — ${percentile} of GTA neighborhoods`
      : tier === 'AVERAGE'
        ? 'about average for the GTA'
        : tier === 'LOW'
          ? `below average — bottom half of GTA neighborhoods`
          : 'minimal coverage for this area';
  const bench = `p10=${fmtInt(benchmark.p10)}, p90=${fmtInt(benchmark.p90)}`;
  const contrib = `adds ${contribution.toFixed(1)} of ${maxContribution.toFixed(1)} possible points to your total`;
  return `${head}. ${tierPhrase} (${bench}). ${contrib}.`;
}

function pickBench(key: keyof ScoreBreakdown, radius: number) {
  const m = BENCHMARKS.metrics[COMPONENT_TO_BENCH[key]];
  return scaleBench(m, radius);
}

export function explainOne(
  key: keyof ScoreBreakdown,
  breakdown: ScoreBreakdown,
  amenities: Amenity[],
  permits: Permit[],
  radius: number,
): ScoreExplanation {
  const score = breakdown[key];
  const w = CONFIG.weights[key];
  const contribution = Number((score * w).toFixed(2));
  const maxContribution = Number((100 * w).toFixed(2));
  const benchmark = pickBench(key, radius);
  const tier = tierFor(score);
  const percentile = percentileFor(score);
  const parts = countBreakdown(key, amenities, permits);
  const total = totalCount(parts);
  const sentence = buildSentence(
    key,
    total,
    parts,
    tier,
    percentile,
    contribution,
    maxContribution,
    benchmark,
  );
  return {
    key,
    label: LABELS[key],
    count: total,
    countBreakdown: parts,
    benchmark,
    score,
    tier,
    percentile,
    weight: w,
    contribution,
    maxContribution,
    sentence,
  };
}

export function explainAll(
  score: LivabilityScore,
  amenities: Amenity[],
  permits: Permit[],
  radius: number,
): ScoreExplanation[] {
  const keys = Object.keys(LABELS) as (keyof ScoreBreakdown)[];
  return keys.map((k) =>
    explainOne(k, score.breakdown, amenities, permits, radius),
  );
}
