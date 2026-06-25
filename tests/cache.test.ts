import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TTLCache } from '@/lib/utils/cache';

describe('TTLCache (LRU bounded)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined for missing keys', () => {
    const c = new TTLCache<string, number>({ maxEntries: 5 });
    expect(c.get('missing')).toBeUndefined();
  });

  it('stores and retrieves values within TTL', () => {
    const c = new TTLCache<string, number>({ maxEntries: 5 });
    c.set('a', 1, 10_000);
    c.set('b', 2, 10_000);
    expect(c.get('a')).toBe(1);
    expect(c.get('b')).toBe(2);
  });

  it('expires entries after TTL', () => {
    const c = new TTLCache<string, number>({ maxEntries: 5 });
    c.set('a', 1, 5_000);
    vi.advanceTimersByTime(6_000);
    expect(c.get('a')).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it('evicts least-recently-used entries when maxEntries is exceeded', () => {
    const c = new TTLCache<string, number>({ maxEntries: 3 });
    c.set('a', 1, 60_000);
    c.set('b', 2, 60_000);
    c.set('c', 3, 60_000);
    expect(c.size).toBe(3);
    c.set('d', 4, 60_000);
    expect(c.size).toBe(3);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
    expect(c.get('d')).toBe(4);
  });

  it('promotes re-accessed entries (LRU touch)', () => {
    const c = new TTLCache<string, number>({ maxEntries: 3 });
    c.set('a', 1, 60_000);
    c.set('b', 2, 60_000);
    c.set('c', 3, 60_000);
    c.get('a');
    c.set('d', 4, 60_000);
    expect(c.get('a')).toBe(1);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('c')).toBe(3);
    expect(c.get('d')).toBe(4);
  });

  it('clear() empties the cache', () => {
    const c = new TTLCache<string, number>({ maxEntries: 5 });
    c.set('a', 1, 60_000);
    c.set('b', 2, 60_000);
    expect(c.size).toBe(2);
    c.clear();
    expect(c.size).toBe(0);
    expect(c.get('a')).toBeUndefined();
  });

  it('clamps maxEntries to >= 1', () => {
    const c = new TTLCache<string, number>({ maxEntries: 0 });
    c.set('a', 1, 60_000);
    c.set('b', 2, 60_000);
    expect(c.size).toBeLessThanOrEqual(1);
  });
});
