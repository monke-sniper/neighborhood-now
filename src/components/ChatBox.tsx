'use client';

import { useState } from 'react';
import type { ChatResponse, NeighborhoodReport } from '@/lib/types';

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
        headers: { 'Content-Type': 'application/json' },
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
          content: err instanceof Error ? err.message : 'Chat failed',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded border border-zinc-800 bg-zinc-900/50">
      <h2 className="text-sm uppercase tracking-widest text-zinc-400">
        Ask about this neighborhood
      </h2>

      <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="text-sm text-zinc-500 italic">
            Try: “Is this area getting more expensive?” or “Is this good for
            families?”
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded text-sm ${
              m.role === 'user'
                ? 'bg-emerald-950/40 border border-emerald-900 self-end max-w-[85%]'
                : 'bg-zinc-950 border border-zinc-800 self-start max-w-[90%]'
            }`}
          >
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
              {m.role === 'user' ? 'You' : 'AI'}
            </div>
            <div className="text-zinc-200 whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="text-sm text-zinc-500 italic">Thinking…</div>
        )}
      </div>

      <form onSubmit={send} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about this area…"
          className="flex-1 px-3 py-2 rounded bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 text-sm"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded bg-emerald-500 text-zinc-950 text-sm font-medium hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          Send
        </button>
      </form>
    </div>
  );
}
