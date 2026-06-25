'use client';

import { useState } from 'react';
import type { NeighborhoodReport } from '@/lib/types';
import { clientHeaders } from '@/lib/api/client';

interface Props {
  onReport: (r: NeighborhoodReport) => void;
  onLoadingChange?: (loading: boolean) => void;
  radius: number;
  hasReport?: boolean;
}

const EXAMPLE_ADDRESSES = [
  '123 QUEEN ST W, TORONTO',
  'CN TOWER, TORONTO',
  'KENSINGTON MARKET, TORONTO',
  'SCARBOROUGH TOWN CENTRE, TORONTO',
];

const RETRYABLE_STATUS = new Set([502, 503, 504, 0]);
const RETRY_BACKOFF_MS = 1500;
const MAX_AUTO_RETRIES = 1;

function formatPhase(stage: 'idle' | 'fetching' | 'retrying' | 'failed'): string {
  if (stage === 'fetching') return 'FETCHING OSM / PERMITS / 311…';
  if (stage === 'retrying') return 'RETRYING…';
  if (stage === 'failed') return 'NETWORK ERROR';
  return '';
}

export function AddressInput({ onReport, onLoadingChange, radius, hasReport }: Props) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'fetching' | 'retrying' | 'failed'>(
    'idle',
  );
  const [attempts, setAttempts] = useState(0);

  function setLoadingState(next: boolean) {
    setLoading(next);
    onLoadingChange?.(next);
  }

  async function fetchReportOnce(addr: string): Promise<NeighborhoodReport> {
    const res = await fetch(
      `/api/report?address=${encodeURIComponent(addr)}&radius=${radius}`,
      { headers: clientHeaders() },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        errors?: Record<string, string | null>;
      };
      const err = new Error(
        data.error || `Request failed (${res.status})`,
      ) as Error & { status?: number; sourceErrors?: Record<string, string | null> };
      err.status = res.status;
      err.sourceErrors = data.errors;
      throw err;
    }
    return (await res.json()) as NeighborhoodReport;
  }

  function isRetryable(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const status = (err as { status?: number }).status;
    if (typeof status === 'number' && RETRYABLE_STATUS.has(status)) return true;
    const msg = (err as Error).message ?? '';
    return /failed|abort|timeout|network|fetch/i.test(msg);
  }

  async function fetchReport(addr: string, attempt = 0): Promise<void> {
    setError(null);
    setLoadingState(true);
    setPhase(attempt === 0 ? 'fetching' : 'retrying');
    setAttempts(attempt + 1);
    try {
      const report = await fetchReportOnce(addr);
      onReport(report);
      setPhase('idle');
    } catch (err) {
      const shouldRetry = attempt < MAX_AUTO_RETRIES && isRetryable(err);
      if (shouldRetry) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
        return fetchReport(addr, attempt + 1);
      }
      const msg = err instanceof Error ? err.message : 'Request failed';
      setError(msg);
      setPhase('failed');
    } finally {
      setLoadingState(false);
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

  function manualRetry() {
    const addr = value.trim();
    if (!addr) return;
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
      {loading && (
        <div className="flex items-center gap-2 text-[10px] text-[var(--color-warn)] uppercase tracking-wider">
          <span className="inline-block w-2 h-2 bg-[var(--color-warn)] animate-pulse" />
          <span>
            {formatPhase(phase)}
            {attempts > 1 ? ` [ ATTEMPT ${attempts} ]` : ''}
          </span>
        </div>
      )}
      {!hasReport && !loading && (
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
        <div className="flex items-center gap-3 text-xs text-[var(--color-bad)] px-1 uppercase tracking-wider">
          <span>[ ERR ] {error}</span>
          <button
            type="button"
            onClick={manualRetry}
            className="px-2 py-0.5 border border-[var(--color-bad)] text-[var(--color-bad)] hover:bg-[var(--color-bad)] hover:text-black transition"
          >
            [ RETRY ]
          </button>
        </div>
      )}
    </form>
  );
}
