'use client';

import { useCallback, useEffect, useState } from 'react';
import type { NeighborhoodReport } from '@/lib/types';
import { clientHeaders } from '@/lib/keys';

export type ReportStatus = 'IDLE' | 'FETCHING' | 'LIVE' | 'ERROR';

interface ReportState {
  report: NeighborhoodReport | null;
  status: ReportStatus;
  loading: boolean;
  error: string | null;
  phase: 'idle' | 'fetching' | 'retrying' | 'failed';
  attempt: number;
  fetchReport: (address: string, radius: number, useCorpus?: boolean) => Promise<void>;
  reset: () => void;
}

const RETRYABLE_STATUS = new Set([502, 503, 504, 0]);
const RETRY_BACKOFF_MS = 1500;
const MAX_AUTO_RETRIES = 1;

async function fetchReportOnce(
  address: string,
  radius: number,
  useCorpus: boolean,
): Promise<NeighborhoodReport> {
  if (useCorpus) {
    try {
      const corpusRes = await fetch(
        `/api/corpus?address=${encodeURIComponent(address)}`,
        { headers: clientHeaders() },
      );
      if (corpusRes.ok) {
        return (await corpusRes.json()) as NeighborhoodReport;
      }
    } catch {
      // fall through to live report
    }
  }
  const res = await fetch(
    `/api/report?address=${encodeURIComponent(address)}&radius=${radius}`,
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

export function useReportState(): ReportState {
  const [report, setReport] = useState<NeighborhoodReport | null>(null);
  const [status, setStatus] = useState<ReportStatus>('IDLE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'fetching' | 'retrying' | 'failed'>(
    'idle',
  );
  const [attempt, setAttempt] = useState(0);

  const fetchReport = useCallback(
    async (address: string, radius: number, useCorpus = false) => {
      setError(null);
      setLoading(true);
      const run = async (n: number): Promise<void> => {
        setPhase(n === 0 ? 'fetching' : 'retrying');
        setStatus('FETCHING');
        setAttempt(n + 1);
        try {
          const r = await fetchReportOnce(address, radius, useCorpus);
          setReport(r);
          setStatus('LIVE');
          setPhase('idle');
        } catch (err) {
          const shouldRetry = n < MAX_AUTO_RETRIES && isRetryable(err);
          if (shouldRetry) {
            await new Promise((res) => setTimeout(res, RETRY_BACKOFF_MS));
            return run(n + 1);
          }
          const msg = err instanceof Error ? err.message : 'Request failed';
          setError(msg);
          setStatus('ERROR');
          setPhase('failed');
        }
      };
      try {
        await run(0);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setReport(null);
    setStatus('IDLE');
    setError(null);
    setPhase('idle');
    setAttempt(0);
  }, []);

  useEffect(() => {
    return () => {
      setReport(null);
    };
  }, []);

  return { report, status, loading, error, phase, attempt, fetchReport, reset };
}
