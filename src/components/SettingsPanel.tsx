'use client';

import { useState } from 'react';
import {
  DEFAULT_KEYS,
  clearClientKeys,
  loadClientKeys,
  saveClientKeys,
  type ClientKeys,
} from '@/lib/keys';

function configuredPill(value: string, fallback: string): string {
  if (value && value !== fallback) return '[ CONFIGURED ]';
  return '[ DEFAULT ]';
}

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<ClientKeys>(() => loadClientKeys());
  const [saved, setSaved] = useState(false);

  function update<K extends keyof ClientKeys>(k: K, v: ClientKeys[K]) {
    setSaved(false);
    setKeys((prev) => ({ ...prev, [k]: v }));
  }

  function save() {
    saveClientKeys(keys);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function reset() {
    clearClientKeys();
    setKeys(DEFAULT_KEYS);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--color-text-dim)] hover:text-[var(--color-accent)]"
      >
        <span className="text-[var(--color-accent)] font-semibold">
          [ SETTINGS // API KEYS ]
        </span>
        <span>
          {configuredPill(keys.ollamaKey, DEFAULT_KEYS.ollamaKey)} ·{' '}
          {open ? '[-]' : '[+]'}
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--color-border)] p-3 flex flex-col gap-2 text-xs">
          <p className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider leading-relaxed">
            KEYS ARE STORED IN YOUR BROWSER ONLY (LOCALSTORAGE). THEY OVERRIDE THE SERVER&apos;S .ENV AT REQUEST TIME VIA X-*-KEY HEADERS. NEVER LOGGED.
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider">
              OLLAMA API KEY
            </span>
            <input
              type="password"
              value={keys.ollamaKey}
              onChange={(e) => update('ollamaKey', e.target.value)}
              placeholder="sk-ollama-…"
              className="px-2 py-1 bg-black border border-[var(--color-border)] text-[var(--color-text)] text-xs focus:outline-none focus:border-[var(--color-accent)] font-mono"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider">
              OLLAMA BASE URL
            </span>
            <input
              type="text"
              value={keys.ollamaBase}
              onChange={(e) => update('ollamaBase', e.target.value)}
              placeholder="https://ollama.com"
              className="px-2 py-1 bg-black border border-[var(--color-border)] text-[var(--color-text)] text-xs focus:outline-none focus:border-[var(--color-accent)] font-mono"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider">
              OLLAMA MODEL
            </span>
            <input
              type="text"
              value={keys.ollamaModel}
              onChange={(e) => update('ollamaModel', e.target.value)}
              placeholder="gpt-oss:20b"
              className="px-2 py-1 bg-black border border-[var(--color-border)] text-[var(--color-text)] text-xs focus:outline-none focus:border-[var(--color-accent)] font-mono"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider">
              US CENSUS API KEY
            </span>
            <input
              type="password"
              value={keys.censusKey}
              onChange={(e) => update('censusKey', e.target.value)}
              placeholder="(optional, US-only)"
              className="px-2 py-1 bg-black border border-[var(--color-border)] text-[var(--color-text)] text-xs focus:outline-none focus:border-[var(--color-accent)] font-mono"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider">
              OPENWEATHER API KEY
            </span>
            <input
              type="password"
              value={keys.weatherKey}
              onChange={(e) => update('weatherKey', e.target.value)}
              placeholder="(optional)"
              className="px-2 py-1 bg-black border border-[var(--color-border)] text-[var(--color-text)] text-xs focus:outline-none focus:border-[var(--color-accent)] font-mono"
            />
          </label>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              className="px-3 py-1.5 bg-[var(--color-accent)] text-black text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--color-accent-dim)]"
            >
              [ SAVE ]
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-3 py-1.5 border border-[var(--color-border-strong)] text-[var(--color-text-mute)] text-[10px] font-bold uppercase tracking-widest hover:text-[var(--color-bad)] hover:border-[var(--color-bad)]"
            >
              [ RESET ]
            </button>
            {saved && (
              <span className="text-[10px] text-[var(--color-accent)] uppercase tracking-wider">
                [ OK ]
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

