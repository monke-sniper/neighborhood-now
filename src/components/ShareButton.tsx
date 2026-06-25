'use client';

import { useEffect, useState } from 'react';
import { buildShareUrl, copyToClipboard } from '@/lib/utils/share';

interface Props {
  address?: string;
  compareA?: string;
  compareB?: string;
  radius: number;
  mode: 'single' | 'compare';
  demo: boolean;
}

function buildLabel(state: {
  address?: string;
  compareA?: string;
  compareB?: string;
  mode: 'single' | 'compare';
}): string {
  if (state.mode === 'compare' && state.compareA && state.compareB) {
    return `Compare: ${state.compareA} vs ${state.compareB}`;
  }
  if (state.address) return `Report: ${state.address}`;
  return 'Neighborhood Now';
}

export function ShareButton(props: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setUrl(
      buildShareUrl(window.location.origin + window.location.pathname, {
        a: props.address ?? '',
        b: props.compareA ?? '',
        radius: props.radius,
        mode: props.mode,
        demo: props.demo,
      }),
    );
  }, [props.address, props.compareA, props.compareB, props.radius, props.mode, props.demo]);

  async function onCopy() {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const label = buildLabel(props);
  const disabled = props.mode === 'single' && !props.address;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="px-2 py-0.5 border border-[var(--color-border)] text-[var(--color-text-mute)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] disabled:opacity-40 disabled:hover:text-[var(--color-text-mute)] disabled:hover:border-[var(--color-border)]"
      >
        [ {open ? 'CLOSE' : 'SHARE'} ]
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-80 p-3 border border-[var(--color-accent)] bg-black shadow-lg flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-mute)]">
            [ SHARE // {label} ]
          </div>
          <div className="text-[10px] text-[var(--color-text-dim)] break-all font-mono">
            {url}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="px-3 py-1 bg-[var(--color-accent)] text-black text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--color-accent-dim)]"
            >
              {copied ? '[ COPIED ]' : '[ COPY URL ]'}
            </button>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(label + ' — Neighborhood Now')}&url=${encodeURIComponent(url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 border border-[var(--color-accent)] text-[var(--color-accent)] text-[10px] font-bold uppercase tracking-widest hover:bg-[#0a1a17]"
            >
              [ POST X ]
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
