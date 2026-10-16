import { LRUCache } from 'lru-cache';

const tokenCache = new LRUCache<string, number>({
  max: 1000,
  ttl: 60 * 1000, // 60 seconds
});

export function rateLimit(key: string, limit: number): boolean {
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    return true;
  }
  const currentCount = tokenCache.get(key) || 0;
  if (currentCount >= limit) {
    return false;
  }
  tokenCache.set(key, currentCount + 1);
  return true;
}

export function resetRateLimit(key: string): void {
  tokenCache.delete(key);
}
