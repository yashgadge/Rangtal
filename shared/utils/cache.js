const cache = new Map();

/**
 * Get cached data if it exists and is not expired
 * @param {string} key 
 */
export const getCachedData = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  return entry;
};

/**
 * Set data in cache with a time-to-live
 * @param {string} key 
 * @param {any} data 
 * @param {number} ttlMs 
 */
export const setCachedData = (key, data, ttlMs = 5 * 60 * 1000) => {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + ttlMs,
  });
};

/**
 * Invalidate cache by exact key or prefix
 * @param {string} prefix 
 */
export const invalidateCache = (prefix) => {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
};
