// scripts/regen-corpus.mjs
// Regenerate the public/data/corpus/* demo reports from synth mode.
// Works fully offline (no Overpass / BuildData / 311 calls). Idempotent.
//
// Usage: node scripts/regen-corpus.mjs [port]
//        (defaults to port 3030)

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const PORT = Number(process.argv[2] ?? 3030);
const BASE = `http://127.0.0.1:${PORT}`;

const ADDRESSES = [
  'CN Tower, Toronto',
  '123 Queen St W, Toronto',
  'Kensington Market, Toronto',
  'Scarborough Town Centre, Toronto',
  'Liberty Village, Toronto',
  'North York Centre, Toronto',
  'The Beaches, Toronto',
  'Bloor-Yonge, Toronto',
  'Rexdale, Etobicoke, Toronto',
  'King-Bay, Toronto',
];

const COMPARE_PAIRS = [
  { file: 'compare-cn-tower-vs-liberty-village.json', a: 'CN Tower, Toronto', b: 'Liberty Village, Toronto' },
  { file: 'compare-cn-tower-vs-scarborough-town-centre.json', a: 'CN Tower, Toronto', b: 'Scarborough Town Centre, Toronto' },
  { file: 'compare-bloor-yonge-vs-rexdale.json', a: 'Bloor-Yonge, Toronto', b: 'Rexdale, Etobicoke, Toronto' },
  { file: 'compare-the-beaches-vs-king-bay.json', a: 'The Beaches, Toronto', b: 'King-Bay, Toronto' },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeFilename(addr) {
  return addr
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function waitForServer() {
  const start = Date.now();
  const timeout = 60_000;
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return true;
    } catch {
      // not ready
    }
    await sleep(500);
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

async function regenerateOne(addr) {
  const url = `${BASE}/api/report?address=${encodeURIComponent(addr)}&synth=1&debug=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    return { address: addr, ok: false, status: res.status };
  }
  const body = await res.json();
  const filename = safeFilename(addr) + '.json';
  const out = path.join(root, 'public', 'data', 'corpus', filename);
  writeFileSync(out, JSON.stringify(body, null, 2), 'utf-8');
  return { address: addr, ok: true, total: body.score?.total, filename };
}

async function regenerateCompare(file, a, b) {
  const url = `${BASE}/api/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&radius=3000&synth=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    return { file, ok: false, status: res.status };
  }
  const body = await res.json();
  const out = path.join(root, 'public', 'data', 'corpus', file);
  writeFileSync(out, JSON.stringify(body, null, 2), 'utf-8');
  return { file, ok: true, delta: body.delta?.total };
}

async function main() {
  mkdirSync(path.join(root, 'public', 'data', 'corpus'), { recursive: true });
  console.log(`[ regen-corpus ] spawning dev server on :${PORT}`);
  const server = startServer();
  let serverExited = false;
  server.on('exit', () => {
    serverExited = true;
  });

  const cleanup = () => {
    if (!serverExited) {
      console.log('[ regen-corpus ] killing dev server');
      killServer(server);
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(1);
  });
  process.on('uncaughtException', (e) => {
    console.error('[ regen-corpus ] uncaught:', e);
    cleanup();
    process.exit(1);
  });

  const ready = await waitForServer();
  if (!ready) {
    console.error('[ regen-corpus ] dev server did not become ready in time');
    cleanup();
    process.exit(1);
  }
  console.log('[ regen-corpus ] server ready');

  console.log(`\n[ regen-corpus ] regenerating ${ADDRESSES.length} single-address reports`);
  let okCount = 0;
  for (const addr of ADDRESSES) {
    try {
      const r = await regenerateOne(addr);
      if (r.ok) {
        okCount++;
        console.log(`  ✓ ${addr.padEnd(36)}  score=${String(r.total).padStart(3)}  → corpus/${r.filename}`);
      } else {
        console.log(`  ✗ ${addr.padEnd(36)}  HTTP ${r.status}`);
      }
    } catch (e) {
      console.log(`  ✗ ${addr.padEnd(36)}  ${e.message}`);
    }
  }

  console.log(`\n[ regen-corpus ] regenerating ${COMPARE_PAIRS.length} compare pairs`);
  let cmpOk = 0;
  for (const { file, a, b } of COMPARE_PAIRS) {
    try {
      const r = await regenerateCompare(file, a, b);
      if (r.ok) {
        cmpOk++;
        console.log(`  ✓ ${a.padEnd(24)} vs ${b.padEnd(28)}  delta=${String(r.delta).padStart(4)}  → corpus/${file}`);
      } else {
        console.log(`  ✗ ${a} vs ${b}  HTTP ${r.status}`);
      }
    } catch (e) {
      console.log(`  ✗ ${a} vs ${b}  ${e.message}`);
    }
  }

  console.log(`\n[ regen-corpus ] done. singles=${okCount}/${ADDRESSES.length}  compares=${cmpOk}/${COMPARE_PAIRS.length}`);
  cleanup();
  if (okCount < ADDRESSES.length || cmpOk < COMPARE_PAIRS.length) process.exit(2);
}

main().catch((e) => {
  console.error('[ regen-corpus ] failed:', e);
  process.exit(1);
});
