'use client';

import { useState } from 'react';
import type { NeighborhoodReport } from '@/lib/types';

interface Props {
  onReport: (r: NeighborhoodReport) => void;
}

export function AddressInput({ onReport }: Props) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const addr = value.trim();
    if (!addr) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/report?address=${encodeURIComponent(addr)}`,
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

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 w-full">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type an address — e.g. 123 Queen St W, Toronto"
          className="flex-1 px-4 py-2 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="px-5 py-2 rounded bg-emerald-500 text-zinc-950 font-medium hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 transition"
        >
          {loading ? 'Loading…' : 'Analyze'}
        </button>
      </div>
      {error && (
        <div className="text-sm text-rose-400 px-1">{error}</div>
      )}
    </form>
  );
}
