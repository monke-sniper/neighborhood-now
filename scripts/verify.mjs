// scripts/verify.mjs
// End-to-end verification. Spawns dev server, hits /api/report for 4 demo
// addresses, writes verification/<address>.json, prints a summary, kills server.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const verificationDir = path.join(root, 'verification');
mkdirSync(verificationDir, { recursive: true });

const PORT = 3939;
const BASE = `http://127.0.0.1:${PORT}`;
const READY_TIMEOUT_MS = 60_000;
const READY_POLL_MS = 500;

const ADDRESSES = [
  '123 Queen St W, Toronto',
  'CN Tower, Toronto',
  'Kensington Market, Toronto',
  'Scarborough Town Centre, Toronto',
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < READY_TIMEOUT_MS) {
    try {
      const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return true;
    } catch {
      // not ready yet
    }
    await sleep(READY_POLL_MS);
  }
  return false;
}

function startServer() {
  const proc = spawn(
    'npx',
    ['next', 'dev', '--port', String(PORT), '--hostname', '127.0.0.1'],
    {
      cwd: root,
      env: { ...process.env, NODE_ENV: 'development' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true,
    },
  );
  proc.stdout.on('data', () => {});
  proc.stderr.on('data', () => {});
  return proc;
}

function killServer(proc) {
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { shell: true });
    } catch {}
  } else {
    try {
      proc.kill('SIGTERM');
    } catch {}
  }
}

function safeFilename(addr) {
  return addr
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function verifyOne(addr) {
  const url = `${BASE}/api/report?address=${encodeURIComponent(addr)}&debug=1`;
  const t0 = Date.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  const ms = Date.now() - t0;
  if (!res.ok) {
    return { address: addr, ok: false, ms, status: res.status };
  }
  const body = await res.json();
  const filename = safeFilename(addr) + '.json';
  const outPath = path.join(verificationDir, filename);
  writeFileSync(outPath, JSON.stringify(body, null, 2), 'utf-8');
  const corpusPath = path.join(root, 'public', 'data', 'corpus', filename);
  try {
    writeFileSync(corpusPath, JSON.stringify(body, null, 2), 'utf-8');
  } catch (e) {
    console.warn(`  ! could not write corpus file ${filename}: ${e.message}`);
  }
  return { address: addr, ok: true, ms, status: 200, body, outPath, corpusPath };
}

function printSummary(result) {
  if (!result.ok) {
    console.log(`  ✗ ${result.address}  (HTTP ${result.status}, ${result.ms}ms)`);
    return;
  }
  const { body } = result;
  const score = body.score;
  const breakdown = score.breakdown;
  const sources = body.sources;
  const anomalies = (body.anomalies ?? []).slice(0, 3);
  const trends = (body.trends ?? []).map((t) => ({
    signal: t.signal,
    method: t.method,
    current: t.current,
    forecast6m: t.forecast6m,
    forecast12m: t.forecast12m,
    confidence: t.confidence,
  }));
  console.log(`  ✓ ${result.address}  (${result.ms}ms)`);
  console.log(`      score        : ${score.total}/100  [${score.ranking?.label ?? '—'}]`);
  console.log(`      breakdown    : amenity=${breakdown.amenityDensity} transit=${breakdown.transitScore} food=${breakdown.foodAccess} green=${breakdown.greenSpace} dev=${breakdown.development}`);
  console.log(`      city average : ${score.cityAverage}`);
  console.log(`      sources      : osm=${sources.overpass} permits=${sources.builddata} 311=${sources.complaints} census=${sources.census} air=${sources.weather}`);
  console.log(`      anomalies    : ${anomalies.length === 0 ? 'none' : anomalies.map((a) => `${a.signal} (${a.severity}, ${a.zscore.toFixed(1)}σ)`).join(' | ')}`);
  console.log(`      trends       : ${trends.length === 0 ? 'none' : trends.map((t) => `${t.signal} ${t.method}/${t.confidence} cur=${t.current} → 6m=${t.forecast6m.toFixed(1)} 12m=${t.forecast12m.toFixed(1)}`).join(' | ')}`);
  if (body.debug) {
    const d = body.debug;
    console.log(`      fetch ms     : overpass=${d.fetches.overpass.ms} builddata=${d.fetches.builddata.ms} complaints=${d.fetches.complaints.ms}`);
    console.log(`      parsed       : restaurants=${d.fetches.overpass.parsed.restaurants} cafes=${d.fetches.overpass.parsed.cafes} schools=${d.fetches.overpass.parsed.schools} groceries=${d.fetches.overpass.parsed.groceries} parks=${d.fetches.overpass.parsed.parks} transit=${d.fetches.overpass.parsed.transitOnSite + d.fetches.overpass.parsed.transitInAmenities}`);
  }
}

async function main() {
  console.log(`[ verify ] spawning dev server on :${PORT}`);
  const server = startServer();
  let serverExited = false;
  server.on('exit', () => {
    serverExited = true;
  });

  const cleanup = () => {
    if (!serverExited) {
      console.log('[ verify ] killing dev server');
      killServer(server);
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(1);
  });
  process.on('uncaughtException', (e) => {
    console.error('[ verify ] uncaught:', e);
    cleanup();
    process.exit(1);
  });

  const ready = await waitForServer();
  if (!ready) {
    console.error('[ verify ] dev server did not become ready in time');
    cleanup();
    process.exit(1);
  }
  console.log(`[ verify ] server ready\n`);

  const results = [];
  for (let i = 0; i < ADDRESSES.length; i++) {
    const addr = ADDRESSES[i];
    try {
      const r = await verifyOne(addr);
      results.push(r);
    } catch (e) {
      results.push({
        address: addr,
        ok: false,
        ms: 0,
        status: 0,
        error: e?.message ?? String(e),
      });
    }
    if (i < ADDRESSES.length - 1) {
      console.log('[ verify ] waiting 2s before next request to avoid Overpass rate limit');
      await sleep(2000);
    }
  }

  console.log(`[ verify ] running compare demo (a=CN Tower, b=Liberty Village)`);
  try {
    const compareUrl = `${BASE}/api/compare?a=${encodeURIComponent('CN Tower, Toronto')}&b=${encodeURIComponent('Liberty Village, Toronto')}`;
    const r = await fetch(compareUrl, { signal: AbortSignal.timeout(120_000) });
    if (r.ok) {
      const body = await r.json();
      const filename = 'compare-cn-tower-vs-liberty-village.json';
      writeFileSync(path.join(verificationDir, filename), JSON.stringify(body, null, 2), 'utf-8');
      writeFileSync(path.join(root, 'public', 'data', 'corpus', filename), JSON.stringify(body, null, 2), 'utf-8');
      console.log(`  ✓ compare → verification/${filename} (delta=${body.delta.total})`);
    } else {
      console.log(`  ✗ compare failed HTTP ${r.status}`);
    }
  } catch (e) {
    console.log(`  ✗ compare error: ${e.message}`);
  }

  console.log(`\n[ verify ] ============ SUMMARY ============`);
  for (const r of results) printSummary(r);

  console.log(`\n[ verify ] ============ ARTIFACTS ============`);
  for (const r of results) {
    if (r.outPath) console.log(`  → ${r.outPath}`);
    if (r.corpusPath) console.log(`  → ${r.corpusPath}`);
  }

  const allOk = results.every((r) => r.ok);
  const allNonThirteen = results.every((r) => r.ok && r.body.score.total !== 13);
  const distinctScores = new Set(results.map((r) => (r.ok ? r.body.score.total : null)));

  console.log(`\n[ verify ] PASS=${allOk ? 'YES' : 'NO'}  ALL_SCORES_DISTINCT=${distinctScores.size === results.length ? 'YES' : 'NO'}  NO_13_100=${allNonThirteen ? 'YES' : 'NO'}`);

  cleanup();
  if (!allOk) process.exit(2);
}

main().catch((e) => {
  console.error('[ verify ] failed:', e);
  process.exit(1);
});
