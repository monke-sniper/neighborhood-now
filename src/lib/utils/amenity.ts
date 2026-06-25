import type { Amenity } from '../types';

const TAG_KEYS = ['leisure', 'landuse', 'amenity', 'shop', 'highway', 'railway', 'public_transport'] as const;

function capitalize(s: string): string {
  if (!s) return s;
  const spaced = s.replace(/_/g, ' ');
  return spaced[0]!.toUpperCase() + spaced.slice(1);
}

function deriveKindLabel(a: Amenity): string {
  const t = a.tags ?? {};
  for (const k of TAG_KEYS) {
    const v = t[k];
    if (v) return `${capitalize(v)} (unnamed)`;
  }
  return `${a.kind}/${a.id.split('/').pop() ?? 'unknown'}`;
}

export function pickName(a: Amenity): string {
  const t = a.tags ?? {};
  return (
    t.name ??
    t['name:en'] ??
    t.brand ??
    t.operator ??
    t.ref ??
    deriveKindLabel(a)
  );
}

export function hasRealName(a: Amenity): boolean {
  const t = a.tags ?? {};
  return Boolean(t.name ?? t['name:en'] ?? t.brand ?? t.operator ?? t.ref);
}
