import { LRUCache } from 'lru-cache';

const tokenCache = new LRUCache<string, number>({
  max: 500,
  ttl: 60000, // 60 seconds
});

export function rateLimit(ip: string, limit: number): boolean {
  const currentCount = tokenCache.get(ip) || 0;
  if (currentCount >= limit) {
    return false;
  }
  tokenCache.set(ip, currentCount + 1);
  return true;
}
