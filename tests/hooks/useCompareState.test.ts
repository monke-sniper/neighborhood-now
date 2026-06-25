// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCompareState } from '@/hooks/useCompareState';

function mockFetchOk(body: unknown) {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
  })) as unknown as typeof fetch;
}

function mockFetchFail(status: number, body: unknown) {
  globalThis.fetch = vi.fn(async () => ({
    ok: false,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe('useCompareState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts IDLE with no result', () => {
    const { result } = renderHook(() => useCompareState());
    expect(result.current.status).toBe('IDLE');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('transitions to DONE on a successful compare', async () => {
    const fake = { a: { address: 'A' }, b: { address: 'B' }, delta: {}, fetchedAt: '', radius: 3000 };
    mockFetchOk(fake);
    const { result } = renderHook(() => useCompareState());
    await act(async () => {
      await result.current.fetchCompare('A', 'B', 3000);
    });
    await waitFor(() => {
      expect(result.current.status).toBe('DONE');
    });
    expect(result.current.result).toEqual(fake);
  });

  it('transitions to ERROR on a 4xx with a corpus hint when useCorpus=true', async () => {
    mockFetchFail(404, { error: 'No synthetic data for "X"' });
    const { result } = renderHook(() => useCompareState());
    await act(async () => {
      await result.current.fetchCompare('A', 'X', 3000, true);
    });
    await waitFor(() => {
      expect(result.current.status).toBe('ERROR');
    });
    expect(result.current.error).toMatch(/only some addresses have a saved corpus/);
  });

  it('transitions to ERROR without the corpus hint when useCorpus=false', async () => {
    mockFetchFail(500, { error: 'oops' });
    const { result } = renderHook(() => useCompareState());
    await act(async () => {
      await result.current.fetchCompare('A', 'B', 3000, false);
    });
    await waitFor(() => {
      expect(result.current.status).toBe('ERROR');
    });
    expect(result.current.error).toBe('oops');
  });

  it('reset() returns the hook to IDLE', async () => {
    mockFetchOk({ a: {}, b: {}, delta: {}, fetchedAt: '', radius: 3000 });
    const { result } = renderHook(() => useCompareState());
    await act(async () => {
      await result.current.fetchCompare('A', 'B', 3000);
    });
    await waitFor(() => {
      expect(result.current.status).toBe('DONE');
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('IDLE');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
