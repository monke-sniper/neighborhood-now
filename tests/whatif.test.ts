import { describe, expect, it } from 'vitest';
import { SCENARIOS, simulateWhatIf } from '@/lib/engine/whatif';
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

const LOW: ScoreBreakdown = {
  amenityDensity: 10,
  transitScore: 10,
  foodAccess: 10,
  greenSpace: 10,
  development: 10,
  civicScore: 10,
  cultureScore: 10,
  recreationScore: 10,
  serviceScore: 10,
};

describe('SCENARIOS', () => {
  it('has at least 6 scenarios', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(6);
  });
  it('has unique IDs', () => {
    const ids = new Set(SCENARIOS.map((s) => s.id));
    expect(ids.size).toBe(SCENARIOS.length);
  });
  it('every scenario has id, name, description, impact', () => {
    for (const s of SCENARIOS) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.impact).toBeDefined();
    }
  });
  it('includes a "school" and "transit_strike" scenario', () => {
    expect(SCENARIOS.find((s) => s.id === 'school')).toBeDefined();
    expect(SCENARIOS.find((s) => s.id === 'transit_strike')).toBeDefined();
  });
});

describe('simulateWhatIf', () => {
  it('returns positive delta for subway in transit-poor area', () => {
    const subway = SCENARIOS.find((s) => s.id === 'subway')!;
    const r = simulateWhatIf(LOW, subway);
    expect(r.delta).toBeGreaterThan(0);
  });

  it('returns negative delta for transit strike', () => {
    const strike = SCENARIOS.find((s) => s.id === 'transit_strike')!;
    const r = simulateWhatIf(NEUTRAL, strike);
    expect(r.delta).toBeLessThan(0);
  });

  it('clamps modified breakdown to 0-100', () => {
    const subway = SCENARIOS.find((s) => s.id === 'subway')!;
    const r = simulateWhatIf(LOW, subway);
    for (const v of Object.values(r.modifiedBreakdown)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('scales transit impact by current transit score (grounded)', () => {
    const subway = SCENARIOS.find((s) => s.id === 'subway')!;
    const lowResult = simulateWhatIf(LOW, subway);
    const rich: ScoreBreakdown = { ...NEUTRAL, transitScore: 80 };
    const richResult = simulateWhatIf(rich, subway);
    expect(lowResult.delta).toBeGreaterThan(richResult.delta);
  });

  it('scales grocery impact by current food access', () => {
    const grocery = SCENARIOS.find((s) => s.id === 'grocery')!;
    const lowResult = simulateWhatIf(LOW, grocery);
    const rich: ScoreBreakdown = { ...NEUTRAL, foodAccess: 80 };
    const richResult = simulateWhatIf(rich, grocery);
    expect(lowResult.delta).toBeGreaterThan(richResult.delta);
  });

  it('before equals total of input breakdown', () => {
    const subway = SCENARIOS.find((s) => s.id === 'subway')!;
    const r = simulateWhatIf(NEUTRAL, subway);
    const total =
      NEUTRAL.amenityDensity * 0.18 +
      NEUTRAL.transitScore * 0.18 +
      NEUTRAL.foodAccess * 0.14 +
      NEUTRAL.greenSpace * 0.10 +
      NEUTRAL.development * 0.10 +
      NEUTRAL.civicScore * 0.075 +
      NEUTRAL.cultureScore * 0.075 +
      NEUTRAL.recreationScore * 0.075 +
      NEUTRAL.serviceScore * 0.075;
    expect(Math.abs(r.before - Math.round(total))).toBeLessThanOrEqual(1);
  });
});
