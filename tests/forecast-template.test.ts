import { describe, expect, it } from 'vitest';
import {
  buildBenchmarkTemplateHistory,
  getBenchmarkTemplate,
  isSparseData,
} from '@/lib/engine/forecast';

describe('benchmark template', () => {
  it('returns 12-month history for permits', () => {
    const h = buildBenchmarkTemplateHistory('Building permits', 12);
    expect(h).toHaveLength(12);
    const total = h.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
  });

  it('returns 12-month history for complaints', () => {
    const h = buildBenchmarkTemplateHistory('311 complaints', 12);
    expect(h).toHaveLength(12);
    expect(h.some((v) => v > 0)).toBe(true);
  });

  it('returns zeros for unknown signal', () => {
    const h = buildBenchmarkTemplateHistory('unknown signal', 12);
    expect(h.every((v) => v === 0)).toBe(true);
  });

  it('getBenchmarkTemplate returns p50 + note for permits', () => {
    const t = getBenchmarkTemplate('Building permits');
    expect(t.benchmarkP50).toBeGreaterThan(0);
    expect(t.history).toHaveLength(12);
    expect(t.note).toContain('Toronto p50');
  });

  it('isSparseData returns true for all-zero history', () => {
    expect(isSparseData([0, 0, 0, 0])).toBe(true);
    expect(isSparseData([])).toBe(true);
  });

  it('isSparseData returns false when any non-zero value', () => {
    expect(isSparseData([0, 0, 1, 0])).toBe(false);
  });
});
