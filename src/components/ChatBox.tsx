'use client';

import { useState } from 'react';
import type { ChatResponse, NeighborhoodReport } from '@/lib/types';
import { clientHeaders } from '@/lib/api/client';

interface Props {
  report: NeighborhoodReport;
}

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatBox({ report }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: clientHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ question: q, report }),
      });
      const data = (await res.json()) as ChatResponse;
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: data.answer },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: err instanceof Error ? err.message : 'CHAT FAILED',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
        <h2 className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-semibold">
          [ ASK // NEIGHBORHOOD AI ]
        </h2>
        <div className="text-[10px] text-[var(--color-text-mute)] uppercase tracking-wider">
          MODEL: OLLAMA
        </div>
      </div>

      <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="text-xs text-[var(--color-text-mute)] uppercase tracking-wider leading-relaxed">
            [ SUGGESTIONS ]<br />
            &gt; IS THIS AREA GETTING MORE EXPENSIVE?<br />
            &gt; IS THIS GOOD FOR FAMILIES?<br />
            &gt; WHAT IS THE AIR QUALITY LIKE?
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 text-xs border ${
              m.role === 'user'
                ? 'bg-[#0a1a17] border-[var(--color-accent)] self-end max-w-[85%]'
                : 'bg-black border-[var(--color-border)] self-start max-w-[90%]'
            }`}
          >
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-accent)] mb-1">
              {m.role === 'user' ? '[ YOU ]' : '[ AI ]'}
            </div>
            <div className="text-[var(--color-text)] whitespace-pre-wrap leading-relaxed">
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-xs text-[var(--color-accent)] uppercase tracking-wider">
            [ AI THINKING<span className="cursor-blink">_</span> ]
          </div>
        )}
      </div>

      <form onSubmit={send} className="flex gap-2">
        <span className="text-[var(--color-accent)] text-xs flex items-center pr-1 select-none">
          &gt;_
        </span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ASK ANYTHING…"
          className="flex-1 px-3 py-2 bg-black border border-[var(--color-border)] text-[var(--color-text)] text-xs placeholder:text-[var(--color-text-mute)] focus:outline-none focus:border-[var(--color-accent)] uppercase tracking-wide"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-[var(--color-accent)] text-black text-xs font-semibold uppercase tracking-widest hover:bg-[var(--color-accent-dim)] disabled:bg-[var(--color-surface-3)] disabled:text-[var(--color-text-mute)] transition"
        >
          [ SEND ]
        </button>
      </form>
    </div>
  );
}
