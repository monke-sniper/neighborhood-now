import { computeTotal } from './score';
import type { Scenario, ScenarioResult, ScoreBreakdown } from '../types';

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'subway',
    name: 'New subway station',
    emoji: '🚇',
    description: 'Major transit expansion within 1km',
    impact: { transitScore: 40, amenityDensity: 5 },
  },
  {
    id: 'park',
    name: 'New park',
    emoji: '🌳',
    description: '2-acre green space added nearby',
    impact: { greenSpace: 25, amenityDensity: 5 },
  },
  {
    id: 'development',
    name: 'Major development',
    emoji: '🏗️',
    description: '500-unit mixed-use building',
    impact: { amenityDensity: 15, transitScore: 5, development: 30 },
  },
  {
    id: 'grocery',
    name: 'New grocery store',
    emoji: '🛒',
    description: 'Full-service supermarket opens',
    impact: { foodAccess: 40 },
  },
] as const;

function clampComponent(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function simulateWhatIf(
  current: ScoreBreakdown,
  scenario: Scenario,
): ScenarioResult {
  const beforeResult = computeTotal(current);
  const before = beforeResult.total;

  const modified: ScoreBreakdown = {
    amenityDensity: clampComponent(
      current.amenityDensity + (scenario.impact.amenityDensity ?? 0),
    ),
    transitScore: clampComponent(
      current.transitScore + (scenario.impact.transitScore ?? 0),
    ),
    foodAccess: clampComponent(
      current.foodAccess + (scenario.impact.foodAccess ?? 0),
    ),
    greenSpace: clampComponent(
      current.greenSpace + (scenario.impact.greenSpace ?? 0),
    ),
    development: clampComponent(
      current.development + (scenario.impact.development ?? 0),
    ),
  };

  const after = computeTotal(modified).total;
  return {
    scenarioId: scenario.id,
    before,
    after,
    delta: after - before,
    modifiedBreakdown: modified,
  };
}
