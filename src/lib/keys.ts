export interface ClientKeys {
  ollamaKey: string;
  ollamaBase: string;
  ollamaModel: string;
  censusKey: string;
  weatherKey: string;
}

export const DEFAULT_KEYS: ClientKeys = {
  ollamaKey: '',
  ollamaBase: 'https://ollama.com',
  ollamaModel: 'gpt-oss:20b',
  censusKey: '',
  weatherKey: '',
};

const STORAGE_KEY = 'nn:keys:v1';

export function loadClientKeys(): ClientKeys {
  if (typeof window === 'undefined') return DEFAULT_KEYS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_KEYS;
    const parsed = JSON.parse(raw) as Partial<ClientKeys>;
    return { ...DEFAULT_KEYS, ...parsed };
  } catch {
    return DEFAULT_KEYS;
  }
}

export function saveClientKeys(keys: ClientKeys): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // ignore quota errors
  }
}

export function clearClientKeys(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function clientHeaders(base?: HeadersInit): HeadersInit {
  const k = loadClientKeys();
  const h = new Headers(base);
  if (k.ollamaKey) h.set('X-Ollama-Key', k.ollamaKey);
  if (k.ollamaBase) h.set('X-Ollama-Base', k.ollamaBase);
  if (k.ollamaModel) h.set('X-Ollama-Model', k.ollamaModel);
  if (k.censusKey) h.set('X-Census-Key', k.censusKey);
  if (k.weatherKey) h.set('X-Weather-Key', k.weatherKey);
  return h;
}
