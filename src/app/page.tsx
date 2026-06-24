'use client';

import { useState } from 'react';
import { AddressInput } from '@/components/AddressInput';
import { AnomalyList } from '@/components/AnomalyList';
import { ChatBox } from '@/components/ChatBox';
import { ForecastChart } from '@/components/ForecastChart';
import { MapView } from '@/components/MapView';
import { ReportCard } from '@/components/ReportCard';
import { WhatIfSimulator } from '@/components/WhatIfSimulator';
import type { NeighborhoodReport } from '@/lib/types';

export default function Home() {
  const [report, setReport] = useState<NeighborhoodReport | null>(null);

  return (
    <main className="min-h-screen w-full max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
      <header className="flex flex-col gap-2 border-b border-zinc-800 pb-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            <span className="text-emerald-400">Neighborhood</span> Now
          </h1>
          <div className="text-xs text-zinc-500 uppercase tracking-widest">
            FutureHacks 2026
          </div>
        </div>
        <p className="text-sm text-zinc-400">
          Type an address. See what is happening. Know where it is going.
        </p>
        <AddressInput onReport={setReport} />
      </header>

      {!report ? (
        <div className="text-zinc-500 text-sm italic text-center py-20">
          Enter an address above to begin.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-4">
            <MapView coords={report.coords} permits={report.permits} />
            <ReportCard report={report} />
            <div className="text-[10px] text-zinc-600 px-1 -mt-2">
              {report.address}
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

      <footer className="text-[10px] text-zinc-600 text-center pt-4 border-t border-zinc-900">
        Data: OpenStreetMap · BuildData Toronto · 311 (file snapshot) ·
        Optional: US Census · OpenWeather · Ollama Cloud
      </footer>
    </main>
  );
}
