import type { Trend } from '../types';
import { BENCHMARKS } from './benchmarks';

const EWMA_ALPHA = 0.3;

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
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

function ewmaForecast(
  history: number[],
): number {
  if (history.length === 0) return 0;
  let s = history[0]!;
  for (let i = 1; i < history.length; i++) {
    s = EWMA_ALPHA * history[i]! + (1 - EWMA_ALPHA) * s;
  }
  return Math.max(0, s);
}

function ewmaSlopeApprox(history: number[]): number {
  if (history.length < 3) return 0;
  const half = Math.floor(history.length / 2);
  const early = mean(history.slice(0, half));
  const late = mean(history.slice(half));
  return (late - early) / half;
}

export interface ForecastBand {
  forecast6m: { value: number; low: number; high: number };
  forecast12m: { value: number; low: number; high: number };
  forecast24m: { value: number; low: number; high: number };
}

export interface ForecastResult extends Trend {
  band: ForecastBand;
  method: 'ewma' | 'ols' | 'flat';
}

export function forecastTrend(
  history: number[],
  signalName: string,
): ForecastResult {
  const n = history.length;
  const last = n > 0 ? history[n - 1]! : 0;
  const clamp = (v: number) => Math.max(0, v);

  if (n === 0) {
    return {
      signal: signalName,
      current: 0,
      slope: 0,
      history: [],
      forecast6m: 0,
      forecast12m: 0,
      forecast24m: 0,
      r2: 0,
      confidence: 'low',
      band: {
        forecast6m: { value: 0, low: 0, high: 0 },
        forecast12m: { value: 0, low: 0, high: 0 },
        forecast24m: { value: 0, low: 0, high: 0 },
      },
      method: 'flat',
    };
  }

  if (n < 3) {
    const v = clamp(last);
    return {
      signal: signalName,
      current: last,
      slope: 0,
      history: [...history],
      forecast6m: v,
      forecast12m: v,
      forecast24m: v,
      r2: 0,
      confidence: 'low',
      band: {
        forecast6m: { value: v, low: v, high: v },
        forecast12m: { value: v, low: v, high: v },
        forecast24m: { value: v, low: v, high: v },
      },
      method: 'flat',
    };
  }

  if (n < 6) {
    const v6 = clamp(ewmaForecast(history));
    const v12 = clamp(ewmaForecast(history));
    const v24 = clamp(ewmaForecast(history));
    const s = std(history);
    return {
      signal: signalName,
      current: last,
      slope: ewmaSlopeApprox(history),
      history: [...history],
      forecast6m: v6,
      forecast12m: v12,
      forecast24m: v24,
      r2: 0,
      confidence: 'low',
      band: {
        forecast6m: { value: v6, low: clamp(v6 - s), high: v6 + s },
        forecast12m: { value: v12, low: clamp(v12 - s * 1.5), high: v12 + s * 1.5 },
        forecast24m: { value: v24, low: clamp(v24 - s * 2), high: v24 + s * 2 },
      },
      method: 'ewma',
    };
  }

  const { slope, r2 } = olsSlope(history);
  const residuals: number[] = [];
  const intercept = mean(history) - slope * ((n - 1) / 2);
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * i;
    residuals.push(history[i]! - pred);
  }
  const sigma = std(residuals);
  const FLOOR_RATIO = 0.7;
  const floor = last * FLOOR_RATIO;
  const band = (steps: number, mult: number) => {
    const olsValue = last + slope * steps;
    const value = clamp(Math.max(floor, olsValue));
    const margin = sigma * mult;
    return {
      value,
      low: clamp(Math.max(0, value - margin)),
      high: clamp(value + margin),
    };
  };

  const confidence: Trend['confidence'] =
    r2 > 0.7 ? 'high' : r2 > 0.4 ? 'medium' : 'low';

  return {
    signal: signalName,
    current: last,
    slope,
    history: [...history],
    forecast6m: band(6, 1).value,
    forecast12m: band(12, 1.5).value,
    forecast24m: band(24, 2).value,
    r2,
    confidence,
    band: {
      forecast6m: band(6, 1),
      forecast12m: band(12, 1.5),
      forecast24m: band(24, 2),
    },
    method: 'ols',
  };
}

function isAllZero(history: number[]): boolean {
  if (history.length === 0) return true;
  return history.every((v) => v === 0);
}

function benchmarkP50ForSignal(signalName: string): number {
  const lower = signalName.toLowerCase();
  if (lower.includes('permit')) {
    const raw = BENCHMARKS.metrics.permits500m.p50;
    if (raw >= 2) return Math.round(raw);
    return 24;
  }
  if (lower.includes('311') || lower.includes('complaint')) {
    const raw = BENCHMARKS.metrics.complaints.p50;
    if (raw >= 2) return Math.round(raw);
    return 36;
  }
  return 0;
}

export function buildBenchmarkTemplateHistory(
  signalName: string,
  months = 12,
): number[] {
  const p50 = benchmarkP50ForSignal(signalName);
  if (p50 <= 0) return Array(months).fill(0);
  const base = p50 / months;
  const out: number[] = [];
  for (let i = 0; i < months; i++) {
    const seasonal = 1 + 0.15 * Math.sin((i / months) * Math.PI * 2);
    const noise = 0.85 + 0.3 * Math.abs(Math.sin(i * 1.7));
    out.push(Math.max(0, Math.round(base * seasonal * noise)));
  }
  return out;
}

export interface BenchmarkTemplate {
  history: number[];
  benchmarkP50: number;
  note: string;
}

export function getBenchmarkTemplate(signalName: string): BenchmarkTemplate {
  const p50 = benchmarkP50ForSignal(signalName);
  return {
    history: buildBenchmarkTemplateHistory(signalName, 12),
    benchmarkP50: p50,
    note:
      p50 > 0
        ? `Toronto p50 for ${signalName.toLowerCase()}: ~${p50}/yr. Template shown until real data populates.`
        : `No benchmark available for ${signalName.toLowerCase()}.`,
  };
}

export function isSparseData(history: number[]): boolean {
  return isAllZero(history);
}
