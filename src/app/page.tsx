'use client';

import { useEffect, useState } from 'react';
import { AddressInput } from '@/components/AddressInput';
import { AnomalyList } from '@/components/AnomalyList';
import { ChatBox } from '@/components/ChatBox';
import { ForecastChart } from '@/components/ForecastChart';
import { MapView } from '@/components/MapView';
import { ReportCard } from '@/components/ReportCard';
import { WhatIfSimulator } from '@/components/WhatIfSimulator';
import type { NeighborhoodReport } from '@/lib/types';

type Status = 'IDLE' | 'FETCHING' | 'LIVE' | 'ERROR';

function formatTime(d: Date): string {
  return d.toISOString().slice(11, 19) + 'Z';
}

export default function Home() {
  const [report, setReport] = useState<NeighborhoodReport | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [status, setStatus] = useState<Status>('IDLE');

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen w-full max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4 bg-black text-[var(--color-text)]">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest border border-[var(--color-border)] bg-black px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-accent)] font-bold">[ NN // NEIGHBORHOOD NOW ]</span>
          <span className="text-[var(--color-text-mute)]">v1.0</span>
        </div>
        <div className="hidden md:flex items-center gap-3 text-[var(--color-text-mute)]">
          <span>
            ADDR:{' '}
            <span className="text-[var(--color-text)]">
              {report ? truncate(report.address, 50) : '—'}
            </span>
          </span>
          <span className="text-[var(--color-text-mute)]">·</span>
          <span>
            SCORE:{' '}
            <span className="text-[var(--color-accent)] tabular-nums">
              {report ? report.score.total : '—'}
            </span>
            /100
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={
              status === 'LIVE'
                ? 'text-[var(--color-accent)]'
                : status === 'FETCHING'
                  ? 'text-[var(--color-warn)]'
                  : status === 'ERROR'
                    ? 'text-[var(--color-bad)]'
                    : 'text-[var(--color-text-mute)]'
            }
          >
            [{status}]
            {status === 'LIVE' && <span className="cursor-blink">_</span>}
          </span>
          <span className="text-[var(--color-text-mute)] tabular-nums">{formatTime(now)}</span>
        </div>
      </div>

      <header className="flex flex-col gap-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text)]">
            <span className="text-[var(--color-accent)]">NEIGHBORHOOD</span>{' '}
            <span>NOW</span>
          </h1>
          <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-widest">
            FUTUREHACKS 2026
          </div>
        </div>
        <p className="text-xs text-[var(--color-text-dim)] uppercase tracking-wider">
          &gt; TYPE AN ADDRESS. SEE WHAT IS HAPPENING. KNOW WHERE IT IS GOING.
        </p>
        <AddressInput
          onReport={(r) => {
            setReport(r);
            setStatus('LIVE');
          }}
        />
      </header>

      {!report ? (
        <div className="text-[var(--color-text-mute)] text-xs uppercase tracking-widest text-center py-20 border border-dashed border-[var(--color-border)]">
          [ IDLE // ENTER AN ADDRESS TO BEGIN ANALYSIS ]
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-4">
            <MapView coords={report.coords} permits={report.permits} />
            <ReportCard report={report} />
            <div className="text-[10px] text-[var(--color-text-mute)] px-1 uppercase tracking-wider truncate">
              [ LOC ] {report.address}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <AnomalyList anomalies={report.anomalies} />
            <ForecastChart trends={report.trends} />
            <WhatIfSimulator current={report.score.breakdown} />
            <ChatBox report={report} />
          </div>
        </div>
      )}

      <footer className="text-[10px] text-[var(--color-text-mute)] text-center pt-4 border-t border-[var(--color-border)] uppercase tracking-widest">
        [ DATA ] OSM · BUILDDATA TORONTO · 311 SNAPSHOT · OPT: US CENSUS · OPENWEATHER · OLLAMA
      </footer>
    </main>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
