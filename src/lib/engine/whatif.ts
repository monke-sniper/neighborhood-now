import { CONFIG } from '../config';
import { computeTotalFromBreakdown } from './score.total';
import { ALL_PRESENT, type DataPresence, type WeightSet } from './score.types';
import type { Scenario, ScenarioResult, ScoreBreakdown } from '../types';

const clamp = (n: number) => Math.max(0, Math.min(100, n));

function transitDelta(current: ScoreBreakdown): number {
  if (current.transitScore < 20) return 50;
  if (current.transitScore < 40) return 40;
  if (current.transitScore < 60) return 30;
  if (current.transitScore < 80) return 20;
  return 12;
}

function greenDelta(current: ScoreBreakdown): number {
  if (current.greenSpace < 20) return 35;
  if (current.greenSpace < 40) return 28;
  if (current.greenSpace < 60) return 22;
  return 15;
}

function foodDelta(current: ScoreBreakdown): number {
  if (current.foodAccess < 20) return 45;
  if (current.foodAccess < 40) return 35;
  if (current.foodAccess < 60) return 25;
  return 12;
}

function schoolDelta(current: ScoreBreakdown): number {
  if (current.amenityDensity < 30) return 30;
  if (current.amenityDensity < 60) return 22;
  return 15;
}

function devDelta(current: ScoreBreakdown): number {
  if (current.development < 30) return 40;
  if (current.development < 60) return 30;
  return 20;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'subway',
    name: 'New subway station',
    emoji: 'M',
    description: 'Major transit expansion within 1km',
    impact: { transitScore: transitDelta, amenityDensity: 5 },
    reason:
      'Adds a major transit node. Marginal utility is highest in transit-poor areas, so the boost scales with how weak the current transit score is.',
  },
  {
    id: 'park',
    name: 'New 2-acre park',
    emoji: 'P',
    description: 'Green space added within 500m',
    impact: { greenSpace: greenDelta, amenityDensity: 3 },
    reason:
      'New green space within walking distance. Larger boost in park-poor areas, smaller boost where green space is already abundant.',
  },
  {
    id: 'development',
    name: '500-unit development',
    emoji: 'D',
    description: 'Major mixed-use building opens',
    impact: {
      amenityDensity: 15,
      transitScore: 5,
      development: devDelta,
    },
    reason:
      'Brings residents and ground-floor retail. Drives development activity up; adds amenity and transit demand. Larger delta in underdeveloped blocks.',
  },
  {
    id: 'grocery',
    name: 'New grocery store',
    emoji: 'G',
    description: 'Full-service supermarket opens',
    impact: { foodAccess: foodDelta },
    reason:
      'Eliminates food-desert risk. Largest delta where food access is currently weakest, smaller delta where the area is already well-served.',
  },
  {
    id: 'school',
    name: 'New public school',
    emoji: 'S',
    description: 'Elementary or middle school opens nearby',
    impact: { amenityDensity: schoolDelta, development: 5 },
    reason:
      'Adds family-serving amenity density and signals a stable, long-term neighborhood. Larger boost in amenity-thin areas.',
  },
  {
    id: 'transit_strike',
    name: 'Transit strike (3 months)',
    emoji: 'X',
    description: 'Subway + bus suspended for a quarter',
    impact: { transitScore: -25, development: -5 },
    reason:
      'Removes transit access temporarily. Larger absolute hit in transit-dependent areas; the development activity dip reflects reduced foot traffic.',
  },
] as const;

function resolveImpact(
  impact: Scenario['impact'],
  current: ScoreBreakdown,
): Partial<ScoreBreakdown> {
  const out: Partial<ScoreBreakdown> = {};
  for (const k of Object.keys(impact) as (keyof ScoreBreakdown)[]) {
    const v = impact[k];
    if (typeof v === 'function') {
      out[k] = v(current);
    } else if (typeof v === 'number') {
      out[k] = v;
    }
  }
  return out;
}

export function applyImpacts(
  current: ScoreBreakdown,
  deltas: Partial<ScoreBreakdown>,
): ScoreBreakdown {
  return {
    amenityDensity: clamp(current.amenityDensity + (deltas.amenityDensity ?? 0)),
    transitScore: clamp(current.transitScore + (deltas.transitScore ?? 0)),
    foodAccess: clamp(current.foodAccess + (deltas.foodAccess ?? 0)),
    greenSpace: clamp(current.greenSpace + (deltas.greenSpace ?? 0)),
    development: clamp(current.development + (deltas.development ?? 0)),
    civicScore: clamp(current.civicScore + (deltas.civicScore ?? 0)),
    cultureScore: clamp(current.cultureScore + (deltas.cultureScore ?? 0)),
    recreationScore: clamp(current.recreationScore + (deltas.recreationScore ?? 0)),
    serviceScore: clamp(current.serviceScore + (deltas.serviceScore ?? 0)),
  };
}

export function totalFor(
  breakdown: ScoreBreakdown,
  presence: DataPresence = ALL_PRESENT,
  weights: WeightSet = CONFIG.weights as WeightSet,
): number {
  return computeTotalFromBreakdown(breakdown, presence, weights).total;
}

export function simulateWhatIf(
  current: ScoreBreakdown,
  scenario: Scenario,
): ScenarioResult {
  const before = totalFor(current);
  const modified = applyImpacts(current, resolveImpact(scenario.impact, current));
  const after = totalFor(modified);
  return {
    scenarioId: scenario.id,
    before,
    after,
    delta: after - before,
    modifiedBreakdown: modified,
  };
}

export interface ComposedScenarios {
  breakdown: ScoreBreakdown;
  total: number;
  delta: number;
  perScenario: Array<{ id: string; delta: number }>;
}

export function composeScenarios(
  current: ScoreBreakdown,
  active: Iterable<string>,
): ComposedScenarios {
  const before = totalFor(current);
  let breakdown: ScoreBreakdown = { ...current };
  const perScenario: Array<{ id: string; delta: number }> = [];
  for (const id of active) {
    const s = SCENARIOS.find((x) => x.id === id);
    if (!s) continue;
    const beforeStep = totalFor(breakdown);
    breakdown = applyImpacts(breakdown, resolveImpact(s.impact, breakdown));
    const afterStep = totalFor(breakdown);
    perScenario.push({ id, delta: afterStep - beforeStep });
  }
  const total = totalFor(breakdown);
  return { breakdown, total, delta: total - before, perScenario };
}

export function scenarioDelta(
  current: ScoreBreakdown,
  scenarioId: string,
): number {
  const s = SCENARIOS.find((x) => x.id === scenarioId);
  if (!s) return 0;
  return simulateWhatIf(current, s).delta;
}
