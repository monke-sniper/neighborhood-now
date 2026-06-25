'use client';

import { useState } from 'react';
import type { NeighborhoodReport } from '@/lib/types';
import { clientHeaders } from '@/lib/api/client';

interface Props {
  onReport: (r: NeighborhoodReport) => void;
  radius: number;
  hasReport?: boolean;
}

const EXAMPLE_ADDRESSES = [
  '123 QUEEN ST W, TORONTO',
  'CN TOWER, TORONTO',
  'KENSINGTON MARKET, TORONTO',
  'SCARBOROUGH TOWN CENTRE, TORONTO',
];

export function AddressInput({ onReport, radius, hasReport }: Props) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchReport(addr: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/report?address=${encodeURIComponent(addr)}&radius=${radius}`,
        { headers: clientHeaders() },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const report = (await res.json()) as NeighborhoodReport;
      onReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const addr = value.trim();
    if (!addr) return;
    await fetchReport(addr);
  }

  function tryExample(addr: string) {
    setValue(addr);
    void fetchReport(addr);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 w-full">
      <div className="flex gap-2">
        <span className="text-[var(--color-accent)] text-xs flex items-center pr-1 select-none">
          &gt;_
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ENTER ADDRESS — e.g. 123 QUEEN ST W, TORONTO"
          className="flex-1 px-3 py-2 bg-black border border-[var(--color-border)] text-[var(--color-text)] text-sm placeholder:text-[var(--color-text-mute)] focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_8px_rgba(94,234,212,0.25)] transition uppercase tracking-wide"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="px-5 py-2 bg-[var(--color-accent)] text-black text-xs font-semibold uppercase tracking-widest hover:bg-[var(--color-accent-dim)] disabled:bg-[var(--color-surface-3)] disabled:text-[var(--color-text-mute)] transition"
        >
          {loading ? '[ FETCHING… ]' : '[ ANALYZE ]'}
        </button>
      </div>
      {!hasReport && (
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
          <span>&gt; TRY:</span>
          {EXAMPLE_ADDRESSES.map((a) => (
            <button
              key={a}
              type="button"
              disabled={loading}
              onClick={() => tryExample(a)}
              className="px-2 py-1 border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
            >
              [ {a} ]
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="text-xs text-[var(--color-bad)] px-1 uppercase tracking-wider">
          [ ERR ] {error}
        </div>
      )}
    </form>
  );
}
