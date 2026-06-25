import type { DataPresence, WeightSet } from './score.types';
import type { ScoreBreakdown } from '../types';

const clamp01 = (n: number): number => Math.max(0, Math.min(100, n));

export function computeTotalFromBreakdown(
  breakdown: ScoreBreakdown,
  presence: DataPresence,
  weights: WeightSet,
): { total: number; maxPossible: number; presence: DataPresence } {
  const keys = Object.keys(breakdown) as (keyof ScoreBreakdown)[];
  const presentKeys = keys.filter((k) => presence[k]);
  const totalWeight = presentKeys.reduce((sum, k) => sum + weights[k], 0);
  const rawTotal = presentKeys.reduce(
    (sum, k) => sum + breakdown[k] * weights[k],
    0,
  );
  const normalized = totalWeight > 0 ? rawTotal / totalWeight : 0;
  const total = Math.round(clamp01(normalized));
  const maxPossible = Math.round(totalWeight * 100);
  return { total, maxPossible, presence };
}
