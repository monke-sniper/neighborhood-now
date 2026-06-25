'use client';

import { useEffect, useRef, useState } from 'react';
import type { ScoreBreakdown } from '@/lib/types';

interface Props {
  breakdown: ScoreBreakdown;
  modified: ScoreBreakdown | null;
}

const LABELS: Array<{ key: keyof ScoreBreakdown; label: string; short: string }> = [
  { key: 'amenityDensity', label: 'AMENITY', short: 'AMN' },
  { key: 'transitScore', label: 'TRANSIT', short: 'TRN' },
  { key: 'foodAccess', label: 'FOOD', short: 'FOD' },
  { key: 'greenSpace', label: 'GREEN', short: 'GRN' },
  { key: 'development', label: 'DEV', short: 'DEV' },
  { key: 'civicScore', label: 'CIVIC', short: 'CIV' },
  { key: 'cultureScore', label: 'CULTURE', short: 'CUL' },
  { key: 'recreationScore', label: 'RECREATION', short: 'REC' },
  { key: 'serviceScore', label: 'SERVICE', short: 'SVC' },
];

const SIZE = 280;
const PADDING = 36;
const RADIUS = SIZE / 2 - PADDING;
const CENTER = SIZE / 2;
const ANIM_MS = 420;

function scoreToPoint(score: number, axisIdx: number, total: number, r: number) {
  const angle = (axisIdx / total) * Math.PI * 2 - Math.PI / 2;
  const value = Math.max(0, Math.min(100, score)) / 100;
  return {
    x: CENTER + Math.cos(angle) * r * value,
    y: CENTER + Math.sin(angle) * r * value,
  };
}

function labelPoint(axisIdx: number, total: number, r: number) {
  const angle = (axisIdx / total) * Math.PI * 2 - Math.PI / 2;
  return {
    x: CENTER + Math.cos(angle) * r,
    y: CENTER + Math.sin(angle) * r,
    angle,
  };
}

function ringFillPath(values: number[], r: number): string {
  const n = values.length;
  if (n === 0) return '';
  const pts = values.map((v, i) => scoreToPoint(v, i, n, r));
  let d = '';
  pts.forEach((p, i) => {
    d += `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)} `;
  });
  return d + 'Z';
}

export function ScoreRadar({ breakdown, modified }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [animating, setAnimating] = useState(true);
  const pathRef = useRef<SVGPathElement | null>(null);
  const modPathRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    setAnimating(true);
    const id = window.setTimeout(() => setAnimating(false), ANIM_MS);
    return () => window.clearTimeout(id);
  }, [breakdown, modified]);

  const values = LABELS.map((l) => breakdown[l.key]);
  const modValues = modified ? LABELS.map((l) => modified[l.key]) : null;

  return (
    <div className="flex flex-col gap-2 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ NEIGHBORHOOD DNA // 9-AXIS FINGERPRINT ]
        </h2>
        <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
          {modValues ? 'TEAL = NOW · AMBER = WHAT-IF' : 'PERCENTILE 0-100'}
        </div>
      </div>
      <div className="flex items-center justify-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width="100%"
          style={{ maxWidth: 320, height: 'auto' }}
          role="img"
          aria-label="Score radar chart"
        >
          {[0.25, 0.5, 0.75, 1].map((p) => (
            <circle
              key={p}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS * p}
              fill="none"
              stroke="#1f1f1f"
              strokeDasharray={p === 1 ? '0' : '2 3'}
            />
          ))}
          {LABELS.map((_, i) => {
            const p = labelPoint(i, LABELS.length, RADIUS);
            return (
              <line
                key={i}
                x1={CENTER}
                y1={CENTER}
                x2={p.x}
                y2={p.y}
                stroke="#1f1f1f"
                strokeWidth={1}
              />
            );
          })}
          {LABELS.map((l, i) => {
            const p = labelPoint(i, LABELS.length, RADIUS + 14);
            const isHover = hover === i;
            return (
              <g key={l.key}>
                <text
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  fontSize={isHover ? 11 : 9}
                  fontFamily="var(--font-mono)"
                  fill={isHover ? '#5eead4' : '#8a8a8a'}
                  style={{ cursor: 'pointer', userSelect: 'none', textTransform: 'uppercase' }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {l.short}
                </text>
              </g>
            );
          })}
          <path
            ref={modPathRef}
            d={modValues ? ringFillPath(modValues, RADIUS) : ''}
            fill="#fbbf24"
            fillOpacity={0.12}
            stroke="#fbbf24"
            strokeOpacity={0.6}
            strokeWidth={1.2}
            strokeDasharray="3 2"
            style={{
              transition: animating ? `d ${ANIM_MS}ms ease` : undefined,
            }}
          />
          <path
            ref={pathRef}
            d={ringFillPath(values, RADIUS)}
            fill="#5eead4"
            fillOpacity={0.18}
            stroke="#5eead4"
            strokeWidth={1.5}
            style={{
              transition: animating ? `d ${ANIM_MS}ms ease` : undefined,
            }}
          />
          {LABELS.map((l, i) => {
            const p = scoreToPoint(values[i]!, i, LABELS.length, RADIUS);
            return (
              <circle
                key={l.key}
                cx={p.x}
                cy={p.y}
                r={hover === i ? 4.5 : 3}
                fill="#5eead4"
                stroke="#000"
                strokeWidth={1}
                style={{ transition: animating ? `all ${ANIM_MS}ms ease` : undefined }}
              />
            );
          })}
        </svg>
      </div>
      {hover !== null ? (
        <div className="text-[10px] text-[var(--color-accent)] uppercase tracking-widest text-center">
          {LABELS[hover]!.label}: {values[hover]}/100
          {modValues ? ` · WHAT-IF: ${modValues[hover]}/100` : ''}
        </div>
      ) : (
        <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-widest text-center">
          HOVER AN AXIS TO SEE THE COMPONENT
        </div>
      )}
      <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider pt-2 border-t border-[var(--color-border)]">
        [ DNA ] THE 9-AXIS POLYGON SHAPE IS THIS NEIGHBORHOOD&apos;S SIGNATURE. TOGGLE WHAT-IF SCENARIOS TO WATCH THE SHAPE MORPH.
      </div>
    </div>
  );
}
