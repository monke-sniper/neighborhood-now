interface Entry<V> {
  value: V;
  expires: number;
}

export interface TTLCacheOptions {
  maxEntries?: number;
}

export class TTLCache<K, V> {
  private store = new Map<K, Entry<V>>();
  private readonly maxEntries: number;

  constructor(opts: TTLCacheOptions = {}) {
    this.maxEntries = Math.max(1, opts.maxEntries ?? 500);
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttlMs: number): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expires: Date.now() + ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
