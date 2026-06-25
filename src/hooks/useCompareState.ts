'use client';

import { useCallback, useState } from 'react';
import type { NeighborhoodReport, ScoreBreakdown } from '@/lib/types';
import { clientHeaders } from '@/lib/keys';

export interface CompareResponse {
  a: NeighborhoodReport;
  b: NeighborhoodReport;
  delta: {
    total: number;
    breakdownDelta: Record<keyof ScoreBreakdown, number>;
    aBetter: string[];
    bBetter: string[];
    anomaliesA: number;
    anomaliesB: number;
    aPermits: number;
    bPermits: number;
    aComplaints: number;
    bComplaints: number;
    aRadiusMeters: number;
    bRadiusMeters: number;
  };
  fetchedAt: string;
  radius: number;
}

export type CompareStatus = 'IDLE' | 'FETCHING' | 'DONE' | 'ERROR';

interface CompareState {
  status: CompareStatus;
  result: CompareResponse | null;
  error: string | null;
  fetchCompare: (a: string, b: string, radius: number, useCorpus?: boolean) => Promise<void>;
  reset: () => void;
}

async function postJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: clientHeaders() });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export function useCompareState(): CompareState {
  const [status, setStatus] = useState<CompareStatus>('IDLE');
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCompare = useCallback(
    async (a: string, b: string, radius: number, useCorpus = false) => {
      setStatus('FETCHING');
      setError(null);

      const url = `/api/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&radius=${radius}${useCorpus ? '&synth=1' : ''}`;

      try {
        const data = await postJson<CompareResponse>(url);
        setResult(data);
        setStatus('DONE');
      } catch (e) {
        if (useCorpus) {
          setError(
            `${e instanceof Error ? e.message : 'Compare failed'} — only some addresses have a saved corpus. Disable [CORPUS] to fetch live.`,
          );
        } else {
          setError(e instanceof Error ? e.message : 'Compare failed');
        }
        setStatus('ERROR');
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setStatus('IDLE');
  }, []);

  return { status, result, error, fetchCompare, reset };
}
