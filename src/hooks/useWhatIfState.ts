'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ScoreBreakdown } from '@/lib/types';
import { composeScenarios, type ComposedScenarios } from '@/lib/engine/whatif';

export interface WhatIfState {
  active: Set<string>;
  toggle: (id: string) => void;
  add: (id: string) => void;
  clear: () => void;
  composed: ComposedScenarios | null;
}

export function useWhatIfState(
  breakdown: ScoreBreakdown | null | undefined,
): WhatIfState {
  const [active, setActive] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const add = useCallback((id: string) => {
    setActive((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setActive(new Set());
  }, []);

  const composed = useMemo<ComposedScenarios | null>(() => {
    if (!breakdown) return null;
    return composeScenarios(breakdown, active);
  }, [breakdown, active]);

  return { active, toggle, add, clear, composed };
}
