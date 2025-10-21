import Redis from "ioredis";

/**
 * Redis cache singleton for FINRA API responses
 * Implements three-tier caching strategy with TTL management
 */

let redis: Redis | null = null;

export function getRedisClient(): Redis | null {
  // Allow graceful degradation when Redis is unavailable
  if (!process.env.REDIS_HOST) {
    console.warn("Redis not configured, caching disabled");
    return null;
  }

  if (!redis) {
    try {
      redis = new Redis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || "0"),
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      redis.on("error", (err) => {
        console.error("Redis client error:", err);
      });

      redis.on("connect", () => {
        console.log("Redis client connected");
      });
    } catch (error) {
      console.error("Failed to initialize Redis:", error);
      return null;
    }
  }

  return redis;
}

/**
 * Cache key builders for consistent naming
 */
export const CacheKeys = {
  regSho: (symbol: string, from?: string, to?: string) =>
    `regsho:${symbol}:${from || ""}:${to || ""}`,

  shortInterest: (symbol: string, from?: string, to?: string) =>
    `si:${symbol}:${from || ""}:${to || ""}`,

  threshold: (symbol: string, from?: string, to?: string) =>
    `threshold:${symbol}:${from || ""}:${to || ""}`,

  dailyMetrics: (symbol: string, date?: string) =>
    `metrics:daily:${symbol}:${date || "latest"}`,

  semiMonthlyMetrics: (symbol: string, date?: string) =>
    `metrics:semi:${symbol}:${date || "latest"}`,

  tickerOverview: (symbol: string) =>
    `overview:${symbol}`,

  screener: (filtersHash: string) =>
    `screener:${filtersHash}`,
};

/**
 * TTL configurations (in seconds)
 */
export const CacheTTL = {
  regSho: parseInt(process.env.CACHE_TTL_REGSHO || "300"), // 5 min
  shortInterest: parseInt(process.env.CACHE_TTL_SHORT_INTEREST || "86400"), // 24 hours
  threshold: parseInt(process.env.CACHE_TTL_THRESHOLD || "300"), // 5 min
  dailyMetrics: 300, // 5 min
  semiMonthlyMetrics: 3600, // 1 hour
  tickerOverview: 300, // 5 min
  screener: 600, // 10 min
};

/**
 * Generic cache get/set helpers with JSON serialization
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const data = await client.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`Cache get error for key ${key}:`, error);
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttl: number
): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Cache set error for key ${key}:`, error);
    return false;
  }
}

export async function cacheDelete(key: string): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.del(key);
    return true;
  } catch (error) {
    console.error(`Cache delete error for key ${key}:`, error);
    return false;
  }
}

/**
 * Batch cache operations
 */
export async function cacheGetMulti<T>(
  keys: string[]
): Promise<Map<string, T>> {
  const client = getRedisClient();
  const result = new Map<string, T>();

  if (!client || keys.length === 0) return result;

  try {
    const values = await client.mget(...keys);
    keys.forEach((key, index) => {
      if (values[index]) {
        try {
          result.set(key, JSON.parse(values[index]!) as T);
        } catch (e) {
          console.error(`Failed to parse cached value for ${key}`);
        }
      }
    });
  } catch (error) {
    console.error("Cache multi-get error:", error);
  }

  return result;
}

/**
 * Pattern-based cache invalidation
 */
export async function cacheInvalidatePattern(pattern: string): Promise<number> {
  const client = getRedisClient();
  if (!client) return 0;

  try {
    const keys = await client.keys(pattern);
    if (keys.length === 0) return 0;

    await client.del(...keys);
    return keys.length;
  } catch (error) {
    console.error(`Cache invalidation error for pattern ${pattern}:`, error);
    return 0;
  }
}

/**
 * Health check
 */
export async function cacheHealthCheck(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const pong = await client.ping();
    return pong === "PONG";
  } catch (error) {
    console.error("Cache health check failed:", error);
    return false;
  }
}

/**
 * Graceful shutdown
 */
export async function closeCacheConnection(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
