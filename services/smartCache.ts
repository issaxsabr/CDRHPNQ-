import { getDB } from './database';
// FIX: Import `ProjectStatus` to use enum values for status checks.
import { BusinessData, ProjectStatus } from '../types';
import { securePack, secureUnpack } from './security';

interface CacheEntry {
  data: BusinessData;
  timestamp: number;
  expiry: number;
}

interface MemoryCacheEntry {
  data: BusinessData;
  expiry: number;
}

export class SmartCache {
  private memoryCache: Map<string, MemoryCacheEntry> = new Map();
  private readonly prefix: string = 'mapscraper_cache_';
  private readonly maxMemoryItems: number = 100;

  private getKey(term: string): string {
    return this.prefix + term.toLowerCase().trim();
  }

  async get(term: string): Promise<BusinessData | null> {
    const key = this.getKey(term);

    const memEntry = this.memoryCache.get(key);
    if (memEntry && Date.now() < memEntry.expiry) {
      this.memoryCache.delete(key);
      this.memoryCache.set(key, memEntry);
      return memEntry.data;
    }

    try {
      const db = await getDB();
      const encryptedEntry = await db.get('cache', key);
      const entry: CacheEntry | null = await secureUnpack(encryptedEntry);

      if (!entry) return null;

      if (Date.now() > entry.expiry) {
        await db.delete('cache', key);
        return null;
      }
      
      this.memoryCache.set(key, { data: entry.data, expiry: entry.expiry });
      this.evictIfNeeded();

      return entry.data;
    } catch (e) {
      console.warn('Error reading from IDB cache', e);
      return null;
    }
  }

  async set(term: string, data: BusinessData, ttl?: number): Promise<void> {
    const key = this.getKey(term);
    const timestamp = Date.now();
    const calculatedTTL = ttl || this.calculateDynamicTTL(data);
    const expiry = timestamp + calculatedTTL;

    this.memoryCache.set(key, { data, expiry });
    this.evictIfNeeded();

    try {
      const db = await getDB();
      const entryToStore: CacheEntry = { data, expiry, timestamp };
      const encryptedEntry = await securePack(entryToStore);
      await db.put('cache', encryptedEntry, key);
    } catch (e) {
      console.warn('Error writing to IDB cache', e);
    }
  }
  
  private calculateDynamicTTL(data: BusinessData): number {
    const baseTime = 24 * 60 * 60 * 1000; // 24h
    
    if (data.emails && data.emails.length > 0 && data.decisionMakers && data.decisionMakers.length > 0) {
      return baseTime * 7; // 7 jours
    }
    
    // FIX: Use `ProjectStatus` enum for type-safe comparison instead of string literals.
    if (data.status === ProjectStatus.NOT_FOUND || data.status === ProjectStatus.ERROR) {
      return 60 * 60 * 1000; // 1 heure
    }
    
    return baseTime; // 24h par défaut
  }

  private evictIfNeeded(): void {
    if (this.memoryCache.size > this.maxMemoryItems) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
  }

  async count(): Promise<number> {
    const db = await getDB();
    return db.count('cache');
  }

  async getAll(): Promise<{ term: string; data: BusinessData; timestamp: number }[]> {
    const db = await getDB();
    const keys = await db.getAllKeys('cache');
    const items = [];

    for(const key of keys) {
        if(typeof key === 'string' && key.startsWith(this.prefix)) {
            const encrypted = await db.get('cache', key);
            const entry: CacheEntry | null = await secureUnpack(encrypted);
            if(entry) {
                items.push({
                    term: key.replace(this.prefix, ''),
                    data: entry.data,
                    timestamp: entry.timestamp
                });
            }
        }
    }
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    const db = await getDB();
    await db.clear('cache');
  }
}