// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useReportState } from '@/hooks/useReportState';

function mockFetchSequence(responses: Array<{ status: number; body?: unknown }>) {
  let i = 0;
  globalThis.fetch = vi.fn(async () => {
    const r = responses[i++] ?? responses[responses.length - 1]!;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body ?? {},
    } as Response;
  }) as unknown as typeof fetch;
}

describe('useReportState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts IDLE with no report', () => {
    const { result } = renderHook(() => useReportState());
    expect(result.current.status).toBe('IDLE');
    expect(result.current.report).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('transitions to LIVE on a successful fetch', async () => {
    const fakeReport = { address: 'CN Tower', score: { total: 90 } };
    mockFetchSequence([{ status: 200, body: fakeReport }]);

    const { result } = renderHook(() => useReportState());
    await act(async () => {
      await result.current.fetchReport('CN Tower', 3000);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('LIVE');
    });
    expect(result.current.report).toEqual(fakeReport);
    expect(result.current.loading).toBe(false);
  });

  it('falls back to /api/report when corpus miss occurs', async () => {
    const fakeReport = { address: 'X', score: { total: 50 } };
    mockFetchSequence([
      { status: 404, body: { error: 'No precomputed report' } },
      { status: 200, body: fakeReport },
    ]);

    const { result } = renderHook(() => useReportState());
    await act(async () => {
      await result.current.fetchReport('X', 3000, true);
    });
    await waitFor(() => {
      expect(result.current.status).toBe('LIVE');
    });
    expect(result.current.report).toEqual(fakeReport);
  });

  it('transitions to ERROR on persistent failure (after retry exhausted)', async () => {
    mockFetchSequence([
      { status: 500, body: { error: 'fail' } },
      { status: 500, body: { error: 'fail' } },
    ]);
    const { result } = renderHook(() => useReportState());
    await act(async () => {
      await result.current.fetchReport('X', 3000);
    });
    await waitFor(() => {
      expect(result.current.status).toBe('ERROR');
    });
    expect(result.current.error).toBe('fail');
    expect(result.current.report).toBeNull();
  });

  it('reset() returns the hook to IDLE with no report', async () => {
    const fakeReport = { address: 'A', score: { total: 70 } };
    mockFetchSequence([{ status: 200, body: fakeReport }]);
    const { result } = renderHook(() => useReportState());
    await act(async () => {
      await result.current.fetchReport('A', 3000);
    });
    await waitFor(() => {
      expect(result.current.status).toBe('LIVE');
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('IDLE');
    expect(result.current.report).toBeNull();
  });
});
