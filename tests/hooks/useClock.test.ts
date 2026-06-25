// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClock } from '@/hooks/useClock';

describe('useClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T15:30:45.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with the current time after the first effect flush', () => {
    const { result } = renderHook(() => useClock(1000));
    expect(result.current.iso).toBe('2026-06-25T15:30:45.000Z');
    expect(result.current.text).toBe('15:30:45Z');
  });

  it('updates to the current time after the first tick', () => {
    const { result } = renderHook(() => useClock(1000));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.iso).toBe('2026-06-25T15:30:45.000Z');
    expect(result.current.text).toBe('15:30:45Z');
  });

  it('advances on each interval tick', () => {
    const { result } = renderHook(() => useClock(1000));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.text).toBe('15:30:46Z');
  });

  it('cleans up the interval on unmount', () => {
    const { unmount } = renderHook(() => useClock(1000));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
