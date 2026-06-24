'use client';

import { useMemo, useState } from 'react';
import { SCENARIOS, simulateWhatIf } from '@/lib/engine/whatif';
import type { ScoreBreakdown } from '@/lib/types';

interface Props {
  current: ScoreBreakdown;
}

function deltaColor(delta: number): string {
  if (delta > 0) return 'text-[var(--color-accent)]';
  if (delta < 0) return 'text-[var(--color-bad)]';
  return 'text-[var(--color-text-mute)]';
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
    const baseScenario = SCENARIOS[0]!;
    const before = simulateWhatIf(current, baseScenario).before;
    const after = simulateWhatIf(modified, baseScenario).after;
    return { after, delta: after - before };
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
    <div className="flex flex-col gap-2 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ WHAT-IF // SIMULATE ]
        </h2>
        {result ? (
          <div className={`text-sm font-bold ${deltaColor(result.delta)} tabular-nums`}>
            {result.delta > 0 ? '+' : ''}
            {result.delta} PTS
          </div>
        ) : (
          <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
            CLICK TO STACK
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
              className={`text-left p-3 border transition ${
                on
                  ? 'border-[var(--color-accent)] bg-[#0a1a17]'
                  : 'border-[var(--color-border)] bg-black hover:border-[var(--color-border-strong)]'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text)]">
                <span className={`text-[10px] px-1.5 py-0.5 font-bold border ${
                  on
                    ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                    : 'border-[var(--color-border-strong)] text-[var(--color-text-mute)]'
                }`}>
                  {s.emoji}
                </span>
                <span className="uppercase tracking-wide">{s.name}</span>
                <span className={`ml-auto text-xs ${deltaColor(single.delta)} tabular-nums`}>
                  {single.delta > 0 ? '+' : ''}
                  {single.delta}
                </span>
              </div>
              <div className="text-[10px] text-[var(--color-text-mute)] mt-1 uppercase tracking-wider">
                {s.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
