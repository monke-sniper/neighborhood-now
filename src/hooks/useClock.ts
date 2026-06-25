'use client';

import { useEffect, useState } from 'react';

function formatTime(d: Date): string {
  return d.toISOString().slice(11, 19) + 'Z';
}

export function useClock(intervalMs: number = 1000): {
  iso: string | null;
  text: string;
} {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return {
    iso: now ? now.toISOString() : null,
    text: now ? formatTime(now) : '--:--:--Z',
  };
}
