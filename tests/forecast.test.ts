import { describe, expect, it } from 'vitest';
import { forecastTrend } from '@/lib/engine/forecast';

describe('forecastTrend', () => {
  it('returns flat forecast for empty history', () => {
    const r = forecastTrend([], 'test');
    expect(r.forecast6m).toBe(0);
    expect(r.confidence).toBe('low');
    expect(r.method).toBe('flat');
  });

  it('returns flat for n<3', () => {
    const r = forecastTrend([1, 2], 'test');
    expect(r.method).toBe('flat');
    expect(r.confidence).toBe('low');
  });

  it('uses EWMA for n=3..5', () => {
    const r = forecastTrend([1, 2, 3, 4], 'test');
    expect(r.method).toBe('ewma');
    expect(r.confidence).toBe('low');
  });

  it('uses OLS for n>=6', () => {
    const r = forecastTrend([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'test');
    expect(r.method).toBe('ols');
  });

  it('produces positive slope for monotonic increasing history', () => {
    const r = forecastTrend([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'test');
    expect(r.slope).toBeGreaterThan(0);
    expect(r.forecast12m).toBeGreaterThan(r.current);
  });

  it('produces negative slope for monotonic decreasing history', () => {
    const r = forecastTrend([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 'test');
    expect(r.slope).toBeLessThan(0);
    expect(r.forecast12m).toBeLessThan(r.current);
  });

  it('clamps forecasts to non-negative', () => {
    const r = forecastTrend([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], 'test');
    expect(r.forecast6m).toBeGreaterThanOrEqual(0);
    expect(r.forecast12m).toBeGreaterThanOrEqual(0);
    expect(r.forecast24m).toBeGreaterThanOrEqual(0);
  });

  it('includes 1σ confidence band', () => {
    const r = forecastTrend([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'test');
    expect(r.band).toBeDefined();
    expect(r.band!.forecast12m.value).toBeCloseTo(r.forecast12m, 1);
    expect(r.band!.forecast12m.high).toBeGreaterThanOrEqual(
      r.band!.forecast12m.value,
    );
    expect(r.band!.forecast12m.low).toBeLessThanOrEqual(
      r.band!.forecast12m.value,
    );
  });

  it('marks high confidence for highly correlated linear data', () => {
    const r = forecastTrend(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      'test',
    );
    expect(r.confidence).toBe('high');
    expect(r.r2).toBeGreaterThan(0.9);
  });
});
