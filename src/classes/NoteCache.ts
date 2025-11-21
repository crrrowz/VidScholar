// classes/NoteCache.ts
import type { CachedData } from '../types';
import config from '../utils/config';

export class NoteCache {
  private cache: Map<string, CachedData>;
  private CACHE_DURATION: number;

  constructor() {
    this.cache = new Map();
    this.CACHE_DURATION = config.getStorageConfig().cacheDuration;
  }

  set(key: string, value: any): void {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now()
    });
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.CACHE_DURATION;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}