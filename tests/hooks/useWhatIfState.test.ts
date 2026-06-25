// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWhatIfState } from '@/hooks/useWhatIfState';

const breakdown = {
  amenityDensity: 50,
  transitScore: 50,
  foodAccess: 50,
  greenSpace: 50,
  development: 50,
  civicScore: 50,
  cultureScore: 50,
  recreationScore: 50,
  serviceScore: 50,
};

describe('useWhatIfState', () => {
  it('starts with an empty active set and a no-op composed result', () => {
    const { result } = renderHook(() => useWhatIfState(breakdown));
    expect(result.current.active.size).toBe(0);
    expect(result.current.composed).not.toBeNull();
    expect(result.current.composed?.delta).toBe(0);
    expect(result.current.composed?.perScenario).toEqual([]);
  });

  it('add() inserts an id, toggle() flips, clear() empties', () => {
    const { result } = renderHook(() => useWhatIfState(breakdown));
    act(() => result.current.add('park'));
    expect(result.current.active.has('park')).toBe(true);
    act(() => result.current.toggle('park'));
    expect(result.current.active.has('park')).toBe(false);
    act(() => result.current.add('subway'));
    act(() => result.current.add('grocery'));
    expect(result.current.active.size).toBe(2);
    act(() => result.current.clear());
    expect(result.current.active.size).toBe(0);
  });

  it('composed is null when breakdown is null/undefined', () => {
    const { result } = renderHook(() => useWhatIfState(null));
    expect(result.current.composed).toBeNull();
  });

  it('composed is non-null when breakdown is provided and at least one scenario is active', () => {
    const { result } = renderHook(() => useWhatIfState(breakdown));
    act(() => result.current.add('park'));
    expect(result.current.composed).not.toBeNull();
    expect(result.current.composed?.breakdown).toBeDefined();
    expect(typeof result.current.composed?.total).toBe('number');
    expect(typeof result.current.composed?.delta).toBe('number');
  });
});
