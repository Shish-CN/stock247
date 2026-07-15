type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  staleUntil: number;
};

export type CacheResult<T> = {
  value: T;
  stale: boolean;
};

export class AsyncTtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  async getOrLoad(
    key: string,
    ttlMs: number,
    staleMs: number,
    loader: () => Promise<T>
  ): Promise<CacheResult<T>> {
    const now = Date.now();
    const existing = this.entries.get(key);
    if (existing && existing.expiresAt > now) return { value: existing.value, stale: false };

    const current = this.inFlight.get(key);
    if (current) return { value: await current, stale: false };

    const promise = loader();
    this.inFlight.set(key, promise);

    try {
      const value = await promise;
      this.entries.set(key, {
        value,
        expiresAt: now + ttlMs,
        staleUntil: now + ttlMs + staleMs
      });
      return { value, stale: false };
    } catch (error) {
      if (existing && existing.staleUntil > now) return { value: existing.value, stale: true };
      throw error;
    } finally {
      this.inFlight.delete(key);
    }
  }
}
