'use client';

import { useState } from 'react';
import type { ScoreExplanation } from '@/lib/engine/explain';

interface Props {
  explanation: ScoreExplanation;
  isModified: boolean;
  modifiedScore: number | null;
  modifiedTier: ScoreExplanation['tier'] | null;
}

function colorFor(score: number): string {
  if (score >= 75) return 'text-[var(--color-accent)]';
  if (score >= 50) return 'text-[var(--color-warn)]';
  return 'text-[var(--color-bad)]';
}

function barColorFor(score: number): string {
  if (score >= 75) return 'bg-[var(--color-accent)]';
  if (score >= 50) return 'bg-[var(--color-warn)]';
  return 'bg-[var(--color-bad)]';
}

function deltaColor(d: number): string {
  if (d > 0) return 'text-[var(--color-accent)]';
  if (d < 0) return 'text-[var(--color-bad)]';
  return 'text-[var(--color-text-mute)]';
}

function deltaSign(d: number): string {
  if (d > 0) return `+${d}`;
  if (d < 0) return `${d}`;
  return '±0';
}

function formatScore(score: number): string {
  if (score === 0) return '—  —';
  return String(score).padStart(3, '0');
}

export function ScoreBar({
  explanation,
  isModified,
  modifiedScore,
  modifiedTier,
}: Props) {
  const [open, setOpen] = useState(false);
  const v = explanation.score;
  const v2 = modifiedScore ?? v;
  const d = v2 - v;
  const changed = d !== 0;
  const tier = modifiedTier ?? explanation.tier;
  const showTier = v2 > 0 || tier !== 'MINIMAL';
  const tierLabel = showTier ? tier : 'NO DATA';

  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex items-center gap-3">
        <div className="w-32 text-[var(--color-text-dim)] uppercase tracking-wider truncate">
          {explanation.label}
        </div>
        <div className="flex-1 h-1.5 bg-[var(--color-surface-3)] overflow-hidden relative">
          <div
            className={`h-full ${barColorFor(v)} transition-all`}
            style={{ width: `${v}%`, opacity: changed ? 0.3 : 1 }}
          />
          {changed && (
            <div
              className={`absolute top-0 left-0 h-full ${barColorFor(v2)} transition-all`}
              style={{ width: `${v2}%` }}
            />
          )}
        </div>
        <div
          className={`w-10 text-right tabular-nums ${colorFor(v2)} font-semibold`}
        >
          {formatScore(v2)}
        </div>
        <div
          className={`w-20 text-right text-[10px] uppercase tracking-wider tabular-nums ${colorFor(v2)}`}
        >
          {tierLabel}
        </div>
        {changed && (
          <div
            className={`w-12 text-right ${deltaColor(d)} tabular-nums text-[10px]`}
          >
            {deltaSign(d)}
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Hide explanation' : 'Show explanation'}
          className="w-6 text-[10px] text-[var(--color-text-mute)] hover:text-[var(--color-accent)]"
        >
          {open ? '[-]' : '[+]'}
        </button>
      </div>
      {open && (
        <div className="ml-32 pl-3 border-l border-[var(--color-border)] py-1 text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider leading-relaxed">
          {explanation.sentence}
        </div>
      )}
    </div>
  );
}
