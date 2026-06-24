import type { Anomaly, Signal } from '../types';

export function detectAnomalies(signals: Signal[]): Anomaly[] {
  const out: Anomaly[] = [];
  for (const s of signals) {
    const zscore =
      s.baseline > 0
        ? (s.current - s.baseline) / Math.sqrt(s.baseline)
        : s.current > 0
          ? 3
          : 0;
    const absZ = Math.abs(zscore);
    if (absZ <= 2) continue;
    const severity: Anomaly['severity'] = absZ > 3 ? 'critical' : 'warning';
    const message =
      zscore >= 0
        ? `${s.name}: ${s.current} ${s.unit} (${zscore.toFixed(1)}σ above normal)`
        : `${s.name}: ${s.current} ${s.unit} (${absZ.toFixed(1)}σ below normal)`;
    out.push({ signal: s.name, zscore, severity, message });
  }
  return out.sort((a, b) => Math.abs(b.zscore) - Math.abs(a.zscore));
}
