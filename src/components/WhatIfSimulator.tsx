'use client';

import { useMemo, useState } from 'react';
import { SCENARIOS, simulateWhatIf } from '@/lib/engine/whatif';
import type { ScoreBreakdown } from '@/lib/types';

interface Props {
  current: ScoreBreakdown;
}

export function WhatIfSimulator({ current }: Props) {
  const [active, setActive] = useState<Set<string>>(new Set());

  const result = useMemo(() => {
    if (active.size === 0) return null;
    let modified: ScoreBreakdown = { ...current };
    for (const id of active) {
      const scenario = SCENARIOS.find((s) => s.id === id);
      if (!scenario) continue;
      const r = simulateWhatIf(modified, scenario);
      modified = r.modifiedBreakdown;
    }
    const before = simulateWhatIf(current, SCENARIOS[0]!).before;
    const after = simulateWhatIf(modified, SCENARIOS[0]!).after;
    void before;
    return { after, delta: after - simulateWhatIf(current, SCENARIOS[0]!).before };
  }, [active, current]);

  function toggle(id: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2 p-4 rounded border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm uppercase tracking-widest text-zinc-400">
          What if…
        </h2>
        {result && (
          <div
            className={`text-sm font-bold ${
              result.delta > 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {result.delta > 0 ? '+' : ''}
            {result.delta} pts
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SCENARIOS.map((s) => {
          const on = active.has(s.id);
          const single = simulateWhatIf(current, s);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              className={`text-left p-3 rounded border transition ${
                on
                  ? 'border-emerald-500 bg-emerald-950/40'
                  : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-600'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                <span className="text-lg">{s.emoji}</span>
                {s.name}
                <span className="ml-auto text-xs text-emerald-400">
                  {single.delta > 0 ? '+' : ''}
                  {single.delta}
                </span>
              </div>
              <div className="text-xs text-zinc-500 mt-1">{s.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
