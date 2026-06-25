'use client';

import { useState } from 'react';
import { useCompareState } from '@/hooks/useCompareState';
import { ComparisonView } from './ComparisonView';
import type { CompareResponse } from '@/hooks/useCompareState';

interface Props {
  radius: number;
  onSwitchToSingle: () => void;
  demoMode: boolean;
}

const PAIR_PRESETS: Array<{ label: string; a: string; b: string }> = [
  {
    label: 'DOWNTOWN VS SUBURBS',
    a: 'CN Tower, Toronto',
    b: 'Scarborough Town Centre, Toronto',
  },
  {
    label: 'TRANSIT-RICH VS CAR-DEPENDENT',
    a: 'Bloor-Yonge, Toronto',
    b: 'Rexdale, Etobicoke, Toronto',
  },
  {
    label: 'BEACHES VS DOWNTOWN CORE',
    a: 'The Beaches, Toronto',
    b: 'King-Bay, Toronto',
  },
];

export function ComparePanel({ radius, onSwitchToSingle, demoMode }: Props) {
  const [a, setA] = useState('CN Tower, Toronto');
  const [b, setB] = useState('Liberty Village, Toronto');
  const { status, result, error, fetchCompare, reset } = useCompareState();

  function submit() {
    void fetchCompare(a, b, radius, demoMode);
  }

  function useDemo() {
    setA('CN Tower, Toronto');
    setB('Liberty Village, Toronto');
    setTimeout(submit, 50);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest border border-[var(--color-accent)] bg-[#0a1a17] px-3 py-2">
        <span className="text-[var(--color-accent)] font-semibold">[ COMPARE // TWO ADDRESSES ]</span>
        <button
          type="button"
          onClick={onSwitchToSingle}
          className="text-[var(--color-text-mute)] hover:text-[var(--color-accent)] border border-[var(--color-border)] px-2 py-0.5"
        >
          [ SINGLE ]
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-mute)]">ADDRESS A</span>
          <input
            type="text"
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="e.g. CN Tower, Toronto"
            className="px-2 py-1.5 bg-black border border-[var(--color-border)] text-[var(--color-text)] text-xs focus:outline-none focus:border-[var(--color-accent)]"
            disabled={status === 'FETCHING'}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-mute)]">ADDRESS B</span>
          <input
            type="text"
            value={b}
            onChange={(e) => setB(e.target.value)}
            placeholder="e.g. Liberty Village, Toronto"
            className="px-2 py-1.5 bg-black border border-[var(--color-border)] text-[var(--color-text)] text-xs focus:outline-none focus:border-[var(--color-accent)]"
            disabled={status === 'FETCHING'}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={status === 'FETCHING' || !a.trim() || !b.trim()}
          className="px-4 py-1.5 bg-[var(--color-accent)] text-black text-xs font-semibold uppercase tracking-widest hover:bg-[var(--color-accent-dim)] disabled:bg-[var(--color-surface-3)] disabled:text-[var(--color-text-mute)]"
        >
          {status === 'FETCHING' ? '[ COMPARING… ]' : '[ COMPARE ]'}
        </button>
        {demoMode && (
          <button
            type="button"
            onClick={useDemo}
            className="px-3 py-1.5 border border-[var(--color-accent)] text-[var(--color-accent)] text-[10px] font-semibold uppercase tracking-widest"
          >
            [ DEMO PAIR ]
          </button>
        )}
        <span className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">PRESETS:</span>
        {PAIR_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setA(p.a);
              setB(p.b);
            }}
            disabled={status === 'FETCHING'}
            className="text-[10px] px-2 py-0.5 border border-[var(--color-border)] text-[var(--color-text-mute)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] disabled:opacity-50 uppercase tracking-wider"
          >
            [ {p.label} ]
          </button>
        ))}
      </div>

      {error && status === 'ERROR' && (
        <div className="text-xs text-[var(--color-bad)] px-1 uppercase tracking-wider">
          [ ERR ] {error}
        </div>
      )}

      {result && (
        <ComparisonView
          result={result as CompareResponse}
          onReset={reset}
        />
      )}
    </div>
  );
}
