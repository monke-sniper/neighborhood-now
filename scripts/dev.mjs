#!/usr/bin/env node
// scripts/dev.mjs
// Robust local dev runner. Kills stale node processes holding the port,
// clears the .next cache, and starts `next dev` on a fixed port.
// Re-runnable safely.
//
// Usage: node scripts/dev.mjs [--port 3000] [--no-clear]

import { spawn, execSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  return fallback;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

const PORT = arg('port', '3000');
const HOST = arg('host', '127.0.0.1');
const noClear = hasFlag('no-clear');

function log(line) {
  console.log(`[ dev ] ${line}`);
}

function safeExec(cmd) {
  try {
    return execSync(cmd, { stdio: 'ignore', timeout: 3000 });
  } catch {
    return null;
  }
}

function killPort(port) {
  if (process.platform !== 'win32') {
    safeExec(`lsof -ti :${port} | xargs -r kill -9`);
    return;
  }
  try {
    const out = execSync(`netstat -ano`, { encoding: 'utf-8', timeout: 3000 });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (line.includes(`:${port}`) && line.includes('LISTENING')) {
        const m = line.match(/\s(\d+)\s*$/);
        if (m) pids.add(m[1]);
      }
    }
    for (const pid of pids) {
      safeExec(`taskkill /pid ${pid} /f /t`);
      log(`killed stale PID ${pid} on :${port}`);
    }
  } catch {
    // ignore
  }
}

function killAllNode() {
  if (process.platform !== 'win32') {
    safeExec(`pkill -9 -f "next dev" || true`);
    return;
  }
  const self = process.pid;
  try {
    const out = execSync(
      `tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH`,
      { encoding: 'utf-8', timeout: 3000 },
    );
    for (const line of out.split('\n')) {
      const m = line.match(/^"node\.exe","(\d+)"/);
      if (m && Number(m[1]) !== self) safeExec(`taskkill /pid ${m[1]} /f /t`);
    }
  } catch {
    // ignore
  }
}

function clearCache() {
  const dir = path.join(root, '.next');
  if (existsSync(dir)) {
    try {
      rmSync(dir, { recursive: true, force: true });
      log('cleared .next/');
    } catch (e) {
      log(`could not clear .next/: ${e.message}`);
    }
  }
}

function startServer() {
  const proc = spawn(
    'npx',
    ['next', 'dev', '--port', PORT, '--hostname', HOST],
    {
      cwd: root,
      env: { ...process.env, NODE_ENV: 'development' },
      stdio: 'inherit',
      shell: true,
      windowsHide: true,
    },
  );
  return proc;
}

function main() {
  log(`cleaning port ${PORT} and stale node processes…`);
  killPort(PORT);
  killAllNode();
  if (!noClear) clearCache();
  log(`starting next dev on http://${HOST}:${PORT}`);
  const proc = startServer();
  const cleanup = () => {
    try {
      proc.kill();
    } catch {
      // ignore
    }
  };
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
  proc.on('exit', (code) => {
    log(`next dev exited with code ${code}`);
    process.exit(code ?? 0);
  });
}

main();
