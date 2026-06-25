import type { NeighborhoodReport, ScoreBreakdown } from '@/lib/types';
import { deriveVerdicts } from '@/lib/engine/verdict';

function safeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export interface ShareState {
  a: string;
  b: string;
  radius: number;
  mode: 'single' | 'compare';
  demo: boolean;
}

export function encodeState(s: Partial<ShareState>): string {
  const parts: string[] = [];
  if (s.a) parts.push(`a=${encodeURIComponent(s.a)}`);
  if (s.b) parts.push(`b=${encodeURIComponent(s.b)}`);
  if (s.radius && s.radius !== 3000) parts.push(`r=${s.radius}`);
  if (s.mode === 'compare') parts.push('mode=compare');
  if (s.demo) parts.push('demo=1');
  return parts.join('&');
}

export function decodeState(search: string): Partial<ShareState> {
  const params = new URLSearchParams(search);
  const out: Partial<ShareState> = {};
  const a = params.get('a');
  const b = params.get('b');
  const r = params.get('r');
  const mode = params.get('mode');
  const demo = params.get('demo');
  if (a) out.a = a;
  if (b) out.b = b;
  if (r) {
    const n = Number(r);
    if (Number.isFinite(n)) out.radius = n;
  }
  if (mode === 'compare') out.mode = 'compare';
  if (demo === '1') out.demo = true;
  return out;
}

export function buildShareUrl(base: string, state: ShareState): string {
  const hash = encodeState(state);
  return hash ? `${base}?${hash}` : base;
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return Promise.resolve(false);
  }
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}

export function reportShareSlug(report: NeighborhoodReport): string {
  return safeKey(report.address);
}

export function verdictHeadline(report: NeighborhoodReport): string {
  const v = deriveVerdicts(report);
  if (v.length === 0) return 'A typical neighborhood';
  return v[0]!.label;
}

export function verdictShorts(breakdown: ScoreBreakdown): string {
  const out: string[] = [];
  if (breakdown.transitScore >= 75) out.push('TRANSIT-RICH');
  if (breakdown.foodAccess < 30) out.push('FOOD-DESERT');
  if (breakdown.greenSpace >= 75) out.push('GREEN-OASIS');
  if (breakdown.development >= 80) out.push('GENTRIFICATION');
  if (breakdown.amenityDensity >= 80) out.push('AMENITY-THICK');
  if (breakdown.serviceScore >= 75) out.push('SERVICE-RICH');
  if (out.length === 0) out.push('MID-PACK');
  return out.join(' / ');
}
