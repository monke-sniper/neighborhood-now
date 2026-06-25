'use client';

import { useEffect, useRef, useState } from 'react';
import { AddressInput } from '@/components/AddressInput';
import { AmenityList } from '@/components/AmenityList';
import { AnomalyList } from '@/components/AnomalyList';
import { ChatBox } from '@/components/ChatBox';
import { ComparePanel } from '@/components/ComparePanel';
import { ForecastChart } from '@/components/ForecastChart';
import { MapView } from '@/components/MapView';
import { NewsTicker } from '@/components/NewsTicker';
import { RadiusSelect } from '@/components/RadiusSelect';
import { RecommendationsPanel } from '@/components/RecommendationsPanel';
import { ReportCard } from '@/components/ReportCard';
import { ReportSkeleton } from '@/components/ReportSkeleton';
import { ScoreRadar } from '@/components/ScoreRadar';
import { SchoolsPanel } from '@/components/SchoolsPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { ShareButton } from '@/components/ShareButton';
import { VerdictPills } from '@/components/VerdictPills';
import { WhatIfSimulator } from '@/components/WhatIfSimulator';
import { useClock } from '@/hooks/useClock';
import { useReportState } from '@/hooks/useReportState';
import { useWhatIfState } from '@/hooks/useWhatIfState';
import { CONFIG } from '@/lib/config';
import { deriveVerdicts } from '@/lib/engine/verdict';
import type { NeighborhoodReport, ScoreBreakdown } from '@/lib/types';
import { decodeState } from '@/lib/utils/share';

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

interface ModifiedView {
  breakdown: ScoreBreakdown;
  total: number;
  delta: number;
}

function buildModifiedView(
  report: NeighborhoodReport,
  composed: { breakdown: ScoreBreakdown; total: number; delta: number } | null,
): ModifiedView | null {
  if (!composed) return null;
  return {
    breakdown: composed.breakdown,
    total: composed.total,
    delta: composed.delta,
  };
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === 'LIVE'
      ? 'text-[var(--color-accent)]'
      : status === 'FETCHING'
        ? 'text-[var(--color-warn)]'
        : status === 'ERROR'
          ? 'text-[var(--color-bad)]'
          : 'text-[var(--color-text-mute)]';
  return (
    <span className={color}>
      [{status}]
      {status === 'LIVE' && <span className="cursor-blink">_</span>}
    </span>
  );
}

function readDemoFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('demo') === '1';
}

export default function Home() {
  const { report, status, loading, fetchReport } = useReportState();
  const { active, toggle, add, composed } = useWhatIfState(report?.score.breakdown);
  const [radius, setRadius] = useState<number>(CONFIG.overpass.defaultRadius);
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [demoMode, setDemoMode] = useState<boolean>(readDemoFromUrl);
  const clock = useClock(1000);
  const hydratedFromUrl = useRef(false);

  useEffect(() => {
    if (hydratedFromUrl.current || typeof window === 'undefined') return;
    hydratedFromUrl.current = true;
    const params = new URLSearchParams(window.location.search);
    const state = decodeState(params.toString());
    if (state.radius && state.radius !== CONFIG.overpass.defaultRadius) {
      setRadius(state.radius as 1000 | 2000 | 3000 | 5000);
    }
    if (state.mode === 'compare') {
      setMode('compare');
    }
    if (state.demo) {
      setDemoMode(true);
    }
    if (state.mode !== 'compare' && state.a) {
      void fetchReport(state.a, state.radius ?? CONFIG.overpass.defaultRadius, state.demo ?? false);
    }
  }, [fetchReport]);

  const modified = report ? buildModifiedView(report, composed) : null;

  return (
    <main className="min-h-screen w-full max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4 bg-black text-[var(--color-text)]">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest border border-[var(--color-border)] bg-black px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-accent)] font-bold">[ NN // NEIGHBORHOOD NOW ]</span>
          <span className="text-[var(--color-text-mute)]">v1.1</span>
          {demoMode && (
            <span className="text-[var(--color-warn)] font-bold">[ DEMO CORPUS ]</span>
          )}
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
          <StatusPill status={status} />
          <span className="text-[var(--color-text-mute)] tabular-nums" suppressHydrationWarning>
            {clock.text}
          </span>
        </div>
      </div>

      <header className="flex flex-col gap-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text)]">
            <span className="text-[var(--color-accent)]">NEIGHBORHOOD</span>{' '}
            <span>NOW</span>
          </h1>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
            <span className="text-[var(--color-text-mute)]">FUTUREHACKS 2026</span>
            <span className="text-[var(--color-text-mute)]">·</span>
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'single' ? 'compare' : 'single'))}
              className={`px-2 py-0.5 border ${
                mode === 'compare'
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-mute)] hover:text-[var(--color-accent)]'
              }`}
            >
              [ {mode === 'single' ? 'COMPARE' : 'SINGLE'} ]
            </button>
            <button
              type="button"
              onClick={() => setDemoMode((d) => !d)}
              className={`px-2 py-0.5 border ${
                demoMode
                  ? 'border-[var(--color-warn)] text-[var(--color-warn)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-mute)] hover:text-[var(--color-warn)]'
              }`}
            >
              [ {demoMode ? 'LIVE' : 'CORPUS'} ]
            </button>
            <ShareButton
              address={mode === 'single' ? report?.address : undefined}
              compareA={mode === 'compare' ? 'CN Tower, Toronto' : undefined}
              compareB={mode === 'compare' ? 'Liberty Village, Toronto' : undefined}
              radius={radius}
              mode={mode}
              demo={demoMode}
            />
          </div>
        </div>
        <p className="text-xs text-[var(--color-text-dim)] uppercase tracking-wider">
          &gt; TYPE AN ADDRESS. SEE WHAT IS HAPPENING. KNOW WHERE IT IS GOING.
        </p>
        {mode === 'single' ? (
          <>
            <AddressInput
              radius={radius}
              hasReport={Boolean(report)}
              onReport={(r) => {
                void fetchReport(r.address, r.radiusMeters, demoMode);
              }}
              onAddress={(addr) => {
                void fetchReport(addr, radius, demoMode);
              }}
            />
            <RadiusSelect value={radius} onChange={setRadius} />
          </>
        ) : (
          <ComparePanel
            radius={radius}
            onSwitchToSingle={() => setMode('single')}
            demoMode={demoMode}
          />
        )}
        <SettingsPanel />
      </header>

      {mode === 'single' && loading ? (
        <ReportSkeleton />
      ) : mode === 'single' && !report ? (
        <div className="text-[var(--color-text-mute)] text-xs uppercase tracking-widest text-center py-20 border border-dashed border-[var(--color-border)]">
          [ IDLE // ENTER AN ADDRESS TO BEGIN ANALYSIS ]
        </div>
      ) : mode === 'single' && report ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-4">
            <VerdictPills verdicts={deriveVerdicts(report)} />
            <MapView coords={report.coords} permits={report.permits} radiusMeters={radius} />
            <ReportCard report={report} modified={modified} />
            <ScoreRadar
              breakdown={report.score.breakdown}
              modified={modified?.breakdown ?? null}
            />
            <AmenityList report={report} radiusMeters={radius} />
            <div className="text-[10px] text-[var(--color-text-mute)] px-1 uppercase tracking-wider truncate">
              [ LOC ] {report.address}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <NewsTicker anomalies={report.anomalies} address={report.address} />
            <AnomalyList anomalies={report.anomalies} />
            <SchoolsPanel report={report} />
            <ForecastChart trends={report.trends} />
            <RecommendationsPanel
              report={report}
              activeScenarios={active}
              onActivate={add}
            />
            <WhatIfSimulator
              current={report.score.breakdown}
              active={active}
              onToggle={toggle}
            />
            <ChatBox report={report} />
          </div>
        </div>
      ) : null}

      <footer className="text-[10px] text-[var(--color-text-mute)] text-center pt-4 border-t border-[var(--color-border)] uppercase tracking-widest">
        [ DATA ] OSM · BUILDDATA TORONTO · 311 LIVE · OPT: US CENSUS · OPENWEATHER · OLLAMA
      </footer>
    </main>
  );
}
