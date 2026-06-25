'use client';

import { useState } from 'react';
import { SCENARIOS, simulateWhatIf } from '@/lib/engine/whatif';
import type { ScoreBreakdown } from '@/lib/types';

interface Props {
  current: ScoreBreakdown;
  active: Set<string>;
  onToggle: (id: string) => void;
}

const COMPONENT_LABELS: Record<keyof ScoreBreakdown, string> = {
  amenityDensity: 'AMENITY',
  transitScore: 'TRANSIT',
  foodAccess: 'FOOD',
  greenSpace: 'GREEN',
  development: 'DEV',
  civicScore: 'CIVIC',
  cultureScore: 'CULTURE',
  recreationScore: 'RECREATION',
  serviceScore: 'SERVICE',
};

function deltaColor(delta: number): string {
  if (delta > 0) return 'text-[var(--color-accent)]';
  if (delta < 0) return 'text-[var(--color-bad)]';
  return 'text-[var(--color-text-mute)]';
}

function deltaSign(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return '±0';
}

function componentDeltas(
  before: ScoreBreakdown,
  after: ScoreBreakdown,
): Array<[keyof ScoreBreakdown, number]> {
  const keys = Object.keys(before) as (keyof ScoreBreakdown)[];
  const out: Array<[keyof ScoreBreakdown, number]> = [];
  for (const k of keys) {
    const d = after[k] - before[k];
    if (d !== 0) out.push([k, d]);
  }
  return out;
}

export function WhatIfSimulator({ current, active, onToggle }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
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
          [ WHAT-IF // STACK SCENARIOS ]
        </h2>
        <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
          {active.size} ACTIVE
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {SCENARIOS.map((s) => {
          const on = active.has(s.id);
          const single = simulateWhatIf(current, s);
          const deltas = componentDeltas(current, single.modifiedBreakdown);
          const isOpen = expanded.has(s.id);
          return (
            <div
              key={s.id}
              className={`border transition ${
                on
                  ? 'border-[var(--color-accent)] bg-[#0a1a17]'
                  : 'border-[var(--color-border)] bg-black hover:border-[var(--color-border-strong)]'
              }`}
            >
              <div className="flex items-center gap-2 p-3">
                <button
                  type="button"
                  onClick={() => onToggle(s.id)}
                  className={`text-[10px] px-1.5 py-0.5 font-bold border ${
                    on
                      ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border-strong)] text-[var(--color-text-mute)]'
                  }`}
                >
                  {on ? '[X]' : s.emoji}
                </button>
                <span className="text-xs font-medium text-[var(--color-text)] uppercase tracking-wide flex-1">
                  {s.name}
                </span>
                <span className={`text-xs ${deltaColor(single.delta)} tabular-nums font-bold`}>
                  {deltaSign(single.delta)}
                </span>
                <button
                  type="button"
                  onClick={() => toggleExpanded(s.id)}
                  className="text-[10px] text-[var(--color-text-mute)] hover:text-[var(--color-accent)] px-1"
                  aria-label={isOpen ? 'Collapse reasoning' : 'Expand reasoning'}
                >
                  {isOpen ? '[-]' : '[+]'}
                </button>
              </div>
              {isOpen && (
                <div className="px-3 pb-3 pt-0 border-t border-[var(--color-border)]">
                  <p className="text-[10px] text-[var(--color-text-mute)] leading-relaxed uppercase tracking-wider pt-2">
                    [ REASON ] {s.reason}
                  </p>
                  {deltas.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 text-[10px] tabular-nums">
                      <span className="text-[var(--color-text-mute)] uppercase">
                        [ COMPONENTS ]
                      </span>
                      {deltas.map(([k, d]) => (
                        <span key={k} className={deltaColor(d)}>
                          {COMPONENT_LABELS[k]} {deltaSign(d)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
