import { NextResponse } from 'next/server';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';
export const maxDuration = 5;

const STARTED_AT = Date.now();

function countCorpusFiles(): number {
  const dir = join(process.cwd(), 'public', 'data', 'corpus');
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

export function GET(): NextResponse {
  return NextResponse.json(
    {
      ok: true,
      service: 'neighborhood-now',
      uptimeMs: Date.now() - STARTED_AT,
      buildSha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
      corpusCount: countCorpusFiles(),
      now: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
