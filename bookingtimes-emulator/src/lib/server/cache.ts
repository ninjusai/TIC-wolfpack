/**
 * Local in-memory cache — replacement for Cloudflare KV.
 * Uses lru-cache for bounded memory usage.
 */

import { LRUCache } from 'lru-cache';

export interface LocalCache {
  get(key: string, options?: { type?: string }): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>;
}

// Single shared cache instance
const cache = new LRUCache<string, string>({
  max: 1000,
  ttl: 1000 * 60 * 60 // default 1 hour
});

export function getLocalCache(): LocalCache {
  return {
    async get(key: string) {
      return cache.get(key) ?? null;
    },

    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      const ttl = options?.expirationTtl ? options.expirationTtl * 1000 : undefined;
      cache.set(key, value, { ttl });
    },

    async delete(key: string) {
      cache.delete(key);
    },

    async list(options?: { prefix?: string }) {
      const prefix = options?.prefix || '';
      const keys: { name: string }[] = [];
      for (const key of cache.keys()) {
        if (key.startsWith(prefix)) keys.push({ name: key });
      }
      return { keys };
    }
  };
}
