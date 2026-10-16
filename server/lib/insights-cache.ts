import { LRUCache } from 'lru-cache';

export interface InsightsData {
  summary: string;
  tips: string[];
  cached?: boolean;
}

// In-memory cache for user insights (TTL: 10 minutes)
const insightsCache = new LRUCache<string, InsightsData>({
  max: 500,
  ttl: 10 * 60 * 1000,
});

/**
 * Key format: `${userId}:${year}:${month}`
 */
export function getInsightsCacheKey(userId: string, year: number, month: number): string {
  return `${userId}:${year}:${month}`;
}

export function getCachedInsights(userId: string, year: number, month: number): InsightsData | undefined {
  return insightsCache.get(getInsightsCacheKey(userId, year, month));
}

export function setCachedInsights(userId: string, year: number, month: number, data: InsightsData): void {
  insightsCache.set(getInsightsCacheKey(userId, year, month), data);
}

/**
 * Invalidate all cached insights for a user across all months.
 * Called whenever a transaction, budget, account, or goal is mutated.
 */
export function clearUserInsightsCache(userId: string): void {
  for (const key of insightsCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      insightsCache.delete(key);
    }
  }
}
