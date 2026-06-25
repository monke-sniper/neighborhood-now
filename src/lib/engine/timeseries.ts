export interface MonthBucket {
  key: string;
  start: Date;
}

export function monthKey(d: Date | number): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthStart(year: number, monthIdx0: number): Date {
  return new Date(Date.UTC(year, monthIdx0, 1));
}

export function lastNMonths(n: number, from: Date = new Date()): MonthBucket[] {
  const out: MonthBucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - i, 1),
    );
    out.push({ key: monthKey(d), start: d });
  }
  return out;
}

export function seriesFromDates(
  dates: string[],
  months: string[],
): number[] {
  const counts = new Map<string, number>();
  for (const m of months) counts.set(m, 0);
  for (const d of dates) {
    const t = Date.parse(d);
    if (!Number.isFinite(t)) continue;
    const k = monthKey(new Date(t));
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return months.map((m) => counts.get(m) ?? 0);
}

export function countWithinDays(
  isoDates: string[],
  days: number,
  nowMs: number = Date.now(),
): number {
  const windowMs = days * 24 * 60 * 60 * 1000;
  let n = 0;
  for (const d of isoDates) {
    const t = Date.parse(d);
    if (Number.isFinite(t) && nowMs - t <= windowMs) n++;
  }
  return n;
}
