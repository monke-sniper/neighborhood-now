import { describe, expect, it } from 'vitest';
import { isUpstreamError, UpstreamError } from '@/lib/errors';

describe('UpstreamError', () => {
  it('has name = UpstreamError', () => {
    const e = new UpstreamError('nominatim', 'boom');
    expect(e.name).toBe('UpstreamError');
    expect(e.source).toBe('nominatim');
    expect(e.status).toBeNull();
  });

  it('preserves status when provided', () => {
    const e = new UpstreamError('builddata', 'HTTP 502', { status: 502 });
    expect(e.status).toBe(502);
  });

  it('toJSON returns a stable shape', () => {
    const e = new UpstreamError('weather', 'down', { status: 503 });
    expect(e.toJSON()).toEqual({
      source: 'weather',
      message: 'down',
      status: 503,
    });
  });
});

describe('isUpstreamError', () => {
  it('returns true for UpstreamError instances', () => {
    expect(isUpstreamError(new UpstreamError('census', 'x'))).toBe(true);
  });
  it('returns false for plain Error', () => {
    expect(isUpstreamError(new Error('x'))).toBe(false);
  });
  it('returns false for null/undefined', () => {
    expect(isUpstreamError(null)).toBe(false);
    expect(isUpstreamError(undefined)).toBe(false);
    expect(isUpstreamError('string')).toBe(false);
    expect(isUpstreamError(42)).toBe(false);
  });
});
