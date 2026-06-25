import { NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function safeKey(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function corpusRoot(): Promise<string> {
  // Single candidate. `process.cwd()` is always the project root for both
  // `next dev` and `next start` (documented Next.js behavior), so we don't
  // need the multi-level `..` fallback chain. The legacy fallback paths
  // were left over from a period when this app lived at a different path
  // on disk and were the source of a Turbopack NFT-list warning.
  const root = path.join(process.cwd(), 'public');
  try {
    const s = await stat(path.join(root, 'data', 'corpus'));
    if (s.isDirectory()) {
      log.info('corpus.root_found', { root });
      return root;
    }
  } catch {
    // fall through to warn
  }
  log.warn('corpus.root_not_found', { cwd: process.cwd(), tried: [root] });
  return root;
}

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const address = url.searchParams.get('address')?.trim();
  if (!address) {
    return NextResponse.json({ error: 'Missing ?address=' }, { status: 400 });
  }
  const key = safeKey(address);
  const root = await corpusRoot();
  const corpusPath = path.join(root, 'data', 'corpus', `${key}.json`);
  log.info('corpus.lookup', { key, cwd: process.cwd(), root, path: corpusPath });
  try {
    const text = await readFile(corpusPath, 'utf-8');
    const body = JSON.parse(text);
    log.info('corpus.hit', { key, source: corpusPath });
    return NextResponse.json({ ...body, _corpus: true });
  } catch (e) {
    log.warn('corpus.read_failed', {
      path: corpusPath,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  log.info('corpus.miss', { key });
  return NextResponse.json(
    { error: 'No precomputed report for this address' },
    { status: 404 },
  );
}
