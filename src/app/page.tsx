'use client';

import { useEffect, useMemo, useState } from 'react';
import { AddressInput } from '@/components/AddressInput';
import { AmenityList } from '@/components/AmenityList';
import { AnomalyList } from '@/components/AnomalyList';
import { ChatBox } from '@/components/ChatBox';
import { ForecastChart } from '@/components/ForecastChart';
import { MapView } from '@/components/MapView';
import { RadiusSelect } from '@/components/RadiusSelect';
import { RecommendationsPanel } from '@/components/RecommendationsPanel';
import { ReportCard } from '@/components/ReportCard';
import { ReportSkeleton } from '@/components/ReportSkeleton';
import { SchoolsPanel } from '@/components/SchoolsPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { WhatIfSimulator } from '@/components/WhatIfSimulator';
import { simulateWhatIf, SCENARIOS } from '@/lib/engine/whatif';
import { computeTotal } from '@/lib/engine/score';
import { CONFIG } from '@/lib/config';
import type { NeighborhoodReport, ScoreBreakdown } from '@/lib/types';

type Status = 'IDLE' | 'FETCHING' | 'LIVE' | 'ERROR';

function formatTime(d: Date): string {
  return d.toISOString().slice(11, 19) + 'Z';
}

function applyScenarios(
  current: ScoreBreakdown,
  active: Set<string>,
): { breakdown: ScoreBreakdown; total: number; delta: number } {
  if (active.size === 0) {
    const t = computeTotal(current).total;
    return { breakdown: current, total: t, delta: 0 };
  }
  let modified: ScoreBreakdown = { ...current };
  for (const id of active) {
    const s = SCENARIOS.find((x) => x.id === id);
    if (!s) continue;
    modified = simulateWhatIf(modified, s).modifiedBreakdown;
  }
  const before = computeTotal(current).total;
  const after = computeTotal(modified).total;
  return { breakdown: modified, total: after, delta: after - before };
}

export default function Home() {
  const [report, setReport] = useState<NeighborhoodReport | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [status, setStatus] = useState<Status>('IDLE');
  const [loading, setLoading] = useState(false);
  const [activeScenarios, setActiveScenarios] = useState<Set<string>>(new Set());
  const [radius, setRadius] = useState<number>(CONFIG.overpass.defaultRadius);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const whatIf = useMemo(
    () =>
      report
        ? applyScenarios(report.score.breakdown, activeScenarios)
        : null,
    [report, activeScenarios],
  );

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
          radius={radius}
          hasReport={Boolean(report)}
          onLoadingChange={setLoading}
          onReport={(r) => {
            setReport(r);
            setStatus('LIVE');
            setLoading(false);
          }}
        />
        <RadiusSelect value={radius} onChange={setRadius} />
        <SettingsPanel />
      </header>

      {loading ? (
        <ReportSkeleton />
      ) : !report ? (
        <div className="text-[var(--color-text-mute)] text-xs uppercase tracking-widest text-center py-20 border border-dashed border-[var(--color-border)]">
          [ IDLE // ENTER AN ADDRESS TO BEGIN ANALYSIS ]
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-4">
            <MapView coords={report.coords} permits={report.permits} />
            <ReportCard
              report={report}
              modified={whatIf && activeScenarios.size > 0 ? whatIf : null}
            />
            <AmenityList report={report} radiusMeters={radius} />
            <div className="text-[10px] text-[var(--color-text-mute)] px-1 uppercase tracking-wider truncate">
              [ LOC ] {report.address}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <AnomalyList anomalies={report.anomalies} />
            <SchoolsPanel report={report} />
            <ForecastChart trends={report.trends} />
            <RecommendationsPanel
              report={report}
              activeScenarios={activeScenarios}
              onActivate={(id) =>
                setActiveScenarios((prev) => {
                  if (prev.has(id)) return prev;
                  const next = new Set(prev);
                  next.add(id);
                  return next;
                })
              }
            />
            <WhatIfSimulator
              current={report.score.breakdown}
              active={activeScenarios}
              onToggle={(id) =>
                setActiveScenarios((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
            />
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
