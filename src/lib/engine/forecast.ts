import type { Trend } from '../types';

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function olsSlope(y: number[]): { slope: number; intercept: number; r2: number } {
  const n = y.length;
  if (n < 2) return { slope: 0, intercept: n === 1 ? y[0]! : 0, r2: 0 };
  const xMean = (n - 1) / 2;
  const yMean = mean(y);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (y[i]! - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * i;
    ssRes += (y[i]! - pred) ** 2;
    ssTot += (y[i]! - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? clamp01(1 - ssRes / ssTot) : 0;
  return { slope, intercept, r2 };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function forecastTrend(
  history: number[],
  signalName: string,
): Trend {
  const n = history.length;
  const last = n > 0 ? history[n - 1]! : 0;

  if (n < 3) {
    return {
      signal: signalName,
      current: last,
      slope: 0,
      history: [...history],
      forecast6m: last,
      forecast12m: last,
      forecast24m: last,
      r2: 0,
      confidence: 'low',
    };
  }

  const { slope, r2 } = olsSlope(history);
  const clamp = (v: number) => Math.max(0, v);

  const confidence: Trend['confidence'] =
    r2 > 0.7 ? 'high' : r2 > 0.4 ? 'medium' : 'low';

  return {
    signal: signalName,
    current: last,
    slope,
    history: [...history],
    forecast6m: clamp(last + slope * 6),
    forecast12m: clamp(last + slope * 12),
    forecast24m: clamp(last + slope * 24),
    r2,
    confidence,
  };
}
