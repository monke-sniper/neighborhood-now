import { describe, expect, it } from 'vitest';
import {
  countWithinDays,
  lastNMonths,
  monthKey,
  monthStart,
  seriesFromDates,
} from '@/lib/engine/timeseries';

describe('monthKey', () => {
  it('formats as YYYY-MM with zero-padded month', () => {
    expect(monthKey(new Date('2026-01-15T00:00:00Z'))).toBe('2026-01');
    expect(monthKey(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12');
  });

  it('handles numeric input', () => {
    expect(monthKey(Date.parse('2026-07-04T00:00:00Z'))).toBe('2026-07');
  });
});

describe('monthStart', () => {
  it('returns the first of the month in UTC', () => {
    const d = monthStart(2026, 5);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(5);
    expect(d.getUTCDate()).toBe(1);
  });
});

describe('lastNMonths', () => {
  it('returns the requested number of months ending at `from`', () => {
    const from = new Date('2026-06-15T12:00:00Z');
    const buckets = lastNMonths(3, from);
    expect(buckets).toHaveLength(3);
    expect(buckets[0]?.key).toBe('2026-04');
    expect(buckets[1]?.key).toBe('2026-05');
    expect(buckets[2]?.key).toBe('2026-06');
  });

  it('crosses year boundaries correctly', () => {
    const buckets = lastNMonths(4, new Date('2026-02-10T00:00:00Z'));
    expect(buckets.map((b) => b.key)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
});

describe('seriesFromDates', () => {
  it('counts dates per month bucket, zero-filling absent months', () => {
    const months = ['2025-12', '2026-01', '2026-02'];
    const series = seriesFromDates(
      [
        '2025-12-15',
        '2026-01-05',
        '2026-01-09',
        '2026-02-01',
        '2026-02-20',
        'not-a-date',
        '2026-02-29',
      ],
      months,
    );
    expect(series).toEqual([1, 2, 2]);
  });

  it('returns all zeros for empty input', () => {
    const months = ['2026-01', '2026-02'];
    expect(seriesFromDates([], months)).toEqual([0, 0]);
  });
});

describe('countWithinDays', () => {
  it('counts only dates within the window relative to now', () => {
    const now = Date.parse('2026-06-24T00:00:00Z');
    const dates = [
      '2026-06-23T00:00:00Z',
      '2026-06-01T00:00:00Z',
      '2025-12-01T00:00:00Z',
      'not-a-date',
    ];
    expect(countWithinDays(dates, 7, now)).toBe(1);
    expect(countWithinDays(dates, 30, now)).toBe(2);
  });
});
