// @vitest-environment happy-dom
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AnomalyList } from '@/components/AnomalyList';
import { VerdictPills } from '@/components/VerdictPills';
import type { Anomaly } from '@/lib/types';
import type { Verdict } from '@/lib/engine/verdict';

afterEach(() => cleanup());

const sampleAnomalies: Anomaly[] = [
  {
    signal: 'Permit surge (last 30d)',
    zscore: 3.4,
    severity: 'critical',
    message: 'BUILDING PERMITS 3.4σ ABOVE NORMAL',
    category: 'gentrification',
  },
  {
    signal: 'Restaurants in 3km',
    zscore: -1.9,
    severity: 'warning',
    message: 'Restaurants in 3km is below normal',
    category: 'livability',
  },
];

describe('<AnomalyList />', () => {
  it('renders the empty state when no anomalies', () => {
    render(<AnomalyList anomalies={[]} />);
    expect(screen.getByText(/NO ANOMALIES DETECTED/)).toBeTruthy();
  });

  it('renders the count and threshold in the header', () => {
    render(<AnomalyList anomalies={sampleAnomalies} />);
    expect(screen.getByText(/ANOMALIES \/\/ 2/)).toBeTruthy();
    expect(screen.getByText(/Z-SCORE THRESHOLD: ±1.8σ/)).toBeTruthy();
  });

  it('renders CRIT for critical and WARN for warning', () => {
    render(<AnomalyList anomalies={sampleAnomalies} />);
    expect(screen.getByText('CRIT')).toBeTruthy();
    expect(screen.getByText('WARN')).toBeTruthy();
  });

  it('formats z-score with a sign and one decimal', () => {
    render(<AnomalyList anomalies={sampleAnomalies} />);
    expect(screen.getByText('+3.4σ')).toBeTruthy();
    expect(screen.getByText('-1.9σ')).toBeTruthy();
  });

  it('caps the visible list at 6 even if more are provided', () => {
    const many: Anomaly[] = Array.from({ length: 10 }, (_, i) => ({
      signal: `s-${i}`,
      zscore: 2,
      severity: 'warning' as const,
      message: `m-${i}`,
      category: 'livability' as const,
    }));
    const { container } = render(<AnomalyList anomalies={many} />);
    const items = container.querySelectorAll('div.flex.items-start.gap-3');
    expect(items.length).toBe(6);
  });
});

const sampleVerdicts: Verdict[] = [
  {
    key: 'transit_rich',
    label: 'TRANSIT-RICH',
    short: 'TRANSIT',
    emoji: 'T',
    reason: 'Transit score 88/100 — top quartile for the city.',
  },
  {
    key: 'food_desert',
    label: 'FOOD DESERT',
    short: 'FOOD DESERT',
    emoji: '-',
    reason: 'Only 1 grocery store in the analysis radius.',
  },
];

describe('<VerdictPills />', () => {
  it('renders the no-verdict state when empty', () => {
    render(<VerdictPills verdicts={[]} />);
    expect(screen.getByText(/NO VERDICT/)).toBeTruthy();
  });

  it('renders all verdict labels with the emoji prefix', () => {
    render(<VerdictPills verdicts={sampleVerdicts} />);
    expect(screen.getByText('[T] TRANSIT-RICH')).toBeTruthy();
    expect(screen.getByText('[-] FOOD DESERT')).toBeTruthy();
  });

  it('shows the primary verdict reason beneath the pills', () => {
    render(<VerdictPills verdicts={sampleVerdicts} />);
    expect(screen.getByText(/Transit score 88\/100/)).toBeTruthy();
  });

  it('pluralises the flag count', () => {
    render(<VerdictPills verdicts={sampleVerdicts} />);
    expect(screen.getByText('2 FLAGS')).toBeTruthy();
  });
});
