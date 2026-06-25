'use client';

import { useEffect, useState } from 'react';
import type {
  NeighborhoodReport,
  Recommendation,
  RecommendationResponse,
  RecommendationThinking,
} from '@/lib/types';
import { clientHeaders } from '@/lib/api/client';

interface Props {
  report: NeighborhoodReport;
  activeScenarios: Set<string>;
  onActivate: (scenarioId: string) => void;
}

const CACHE_KEY = 'nn:recommendations:v2';

interface CachedRecs {
  address: string;
  recommendations: Recommendation[];
  thinking: RecommendationThinking;
  ideas: string;
  modelUsed: string;
}

function loadCache(address: string): CachedRecs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRecs;
    return parsed.address === address ? parsed : null;
  } catch {
    return null;
  }
}

function saveCache(data: CachedRecs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

function clearCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

export function RecommendationsPanel({
  report,
  activeScenarios,
  onActivate,
}: Props) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [thinking, setThinking] = useState<RecommendationThinking | null>(null);
  const [ideas, setIdeas] = useState<string>('');
  const [modelUsed, setModelUsed] = useState<string>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheKey, setCacheKey] = useState(0);
  const [showThinking, setShowThinking] = useState(false);
  const [showIdeas, setShowIdeas] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = loadCache(report.address);
    if (cached) {
      setRecs(cached.recommendations);
      setThinking(cached.thinking);
      setIdeas(cached.ideas);
      setModelUsed(cached.modelUsed);
      return;
    }
    setRecs([]);
    setThinking(null);
    setIdeas('');
    setModelUsed('loading');
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch('/api/recommend', {
          method: 'POST',
          headers: clientHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ report }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as RecommendationResponse;
        if (cancelled) return;
        setRecs(data.recommendations);
        setThinking(data.thinking);
        setIdeas(data.ideas);
        setModelUsed(data.modelUsed);
        saveCache({
          address: report.address,
          recommendations: data.recommendations,
          thinking: data.thinking,
          ideas: data.ideas,
          modelUsed: data.modelUsed,
        });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to fetch');
        setModelUsed('error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [report, cacheKey]);

  function refresh() {
    clearCache();
    setCacheKey((k) => k + 1);
  }

  const isFallback = modelUsed === 'fallback';

  return (
    <div className="flex flex-col gap-2 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ AI RECOMMENDATIONS ]
        </h2>
        <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
          <span>
            MODEL: {modelUsed.toUpperCase()}
            {isFallback && ' (DETERMINISTIC)'}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="px-1.5 py-0.5 border border-[var(--color-border-strong)] text-[var(--color-text-mute)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] disabled:opacity-50"
          >
            {loading ? '[…]' : '[ REFRESH ]'}
          </button>
        </div>
      </div>

      {loading && recs.length === 0 && (
        <div className="text-xs text-[var(--color-accent)] uppercase tracking-wider py-3 text-center">
          [ AI ANALYZING<span className="cursor-blink">_</span> ]
        </div>
      )}

      {error && recs.length === 0 && (
        <div className="text-xs text-[var(--color-bad)] uppercase tracking-wider py-2">
          [ ERR ] {error}
        </div>
      )}

      {recs.length === 0 && !loading && !error && (
        <div className="text-xs text-[var(--color-text-mute)] uppercase tracking-wider py-2 text-center">
          [ NO RECOMMENDATIONS // SCORE ALREADY OPTIMAL ]
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {recs.map((r) => {
          const on = activeScenarios.has(r.scenarioId);
          return (
            <li
              key={r.id}
              className={`border ${
                on
                  ? 'border-[var(--color-accent)] bg-[#0a1a17]'
                  : 'border-[var(--color-border)] bg-black hover:border-[var(--color-border-strong)]'
              }`}
            >
              <button
                type="button"
                onClick={() => onActivate(r.scenarioId)}
                className="w-full text-left p-3 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wide text-[var(--color-text)] font-medium">
                    {r.title}
                  </span>
                  <span
                    className={`text-xs tabular-nums font-bold ${
                      r.expectedDelta > 0
                        ? 'text-[var(--color-accent)]'
                        : 'text-[var(--color-text-mute)]'
                    }`}
                  >
                    {r.expectedDelta > 0 ? `+${r.expectedDelta}` : '±0'} pts
                  </span>
                </div>
                <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider leading-relaxed">
                  {r.reasoning}
                </div>
                <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider pt-1 border-t border-[var(--color-border)]">
                  [ {on ? '✓ ACTIVE' : 'CLICK TO SIMULATE'} ] · {r.scenarioId}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {ideas && (
        <div className="border border-[var(--color-border)] bg-black">
          <button
            type="button"
            onClick={() => setShowIdeas((s) => !s)}
            className="w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--color-text-dim)] hover:text-[var(--color-accent)]"
          >
            <span className="text-[var(--color-accent)] font-semibold">
              [ IDEAS // CREATIVE AI SUGGESTIONS ]
            </span>
            <span>{showIdeas ? '[-]' : '[+]'}</span>
          </button>
          {showIdeas && (
            <div className="border-t border-[var(--color-border)] p-3 text-xs text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
              {ideas}
            </div>
          )}
        </div>
      )}

      {thinking && (
        <div className="border border-[var(--color-border)] bg-black">
          <button
            type="button"
            onClick={() => setShowThinking((s) => !s)}
            className="w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--color-text-dim)] hover:text-[var(--color-accent)]"
          >
            <span className="text-[var(--color-accent)] font-semibold">
              [ THINKING // AI INPUT + RAW OUTPUT ]
            </span>
            <span>{showThinking ? '[-]' : '[+]'}</span>
          </button>
          {showThinking && (
            <div className="border-t border-[var(--color-border)] p-3 flex flex-col gap-3 text-[10px]">
              <div>
                <div className="text-[var(--color-text-mute)] uppercase tracking-widest mb-1">
                  [ PROMPT SENT TO MODEL ]
                </div>
                <pre className="text-[var(--color-text-dim)] font-mono whitespace-pre-wrap break-words leading-relaxed max-h-48 overflow-y-auto">
                  {thinking.prompt}
                </pre>
              </div>
              <div>
                <div className="text-[var(--color-text-mute)] uppercase tracking-widest mb-1">
                  [ RAW MODEL RESPONSE ]
                </div>
                <pre className="text-[var(--color-text-dim)] font-mono whitespace-pre-wrap break-words leading-relaxed max-h-48 overflow-y-auto">
                  {thinking.raw}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
