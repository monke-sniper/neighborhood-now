import { describe, expect, it } from 'vitest';
import {
  composeScenarios,
  scenarioDelta,
  SCENARIOS,
  simulateWhatIf,
  totalFor,
} from '@/lib/engine/whatif';
import type { ScoreBreakdown } from '@/lib/types';

const NEUTRAL: ScoreBreakdown = {
  amenityDensity: 50,
  transitScore: 50,
  foodAccess: 50,
  greenSpace: 50,
  development: 50,
  civicScore: 50,
  cultureScore: 50,
  recreationScore: 50,
  serviceScore: 50,
};

describe('composeScenarios', () => {
  it('returns no delta when no active scenarios', () => {
    const r = composeScenarios(NEUTRAL, []);
    expect(r.delta).toBe(0);
    expect(r.total).toBe(totalFor(NEUTRAL));
    expect(r.perScenario).toEqual([]);
  });

  it('ignores unknown scenario IDs', () => {
    const r = composeScenarios(NEUTRAL, ['bogus']);
    expect(r.delta).toBe(0);
  });

  it('stacks two scenarios and tracks per-scenario deltas', () => {
    const r = composeScenarios(NEUTRAL, ['subway', 'park']);
    expect(r.perScenario).toHaveLength(2);
    expect(r.perScenario[0]?.id).toBe('subway');
    expect(r.perScenario[1]?.id).toBe('park');
    expect(r.delta).toBe(r.total - totalFor(NEUTRAL));
  });

  it('is order-independent on the final total (commutative stack)', () => {
    const r1 = composeScenarios(NEUTRAL, ['subway', 'park', 'development']);
    const r2 = composeScenarios(NEUTRAL, ['development', 'subway', 'park']);
    expect(r1.total).toBe(r2.total);
    expect(r1.delta).toBe(r2.delta);
  });
});

describe('scenarioDelta', () => {
  it('returns the delta of a single scenario', () => {
    const single = simulateWhatIf(NEUTRAL, SCENARIOS[0]!);
    expect(scenarioDelta(NEUTRAL, SCENARIOS[0]!.id)).toBe(single.delta);
  });

  it('returns 0 for unknown scenario', () => {
    expect(scenarioDelta(NEUTRAL, 'nope')).toBe(0);
  });
});
