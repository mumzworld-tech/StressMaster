import { LoadTestSpec } from "../../types";
import * as fs from "fs";
import * as path from "path";

export interface ParseCacheConfig {
  maxSize: number;
  ttlMinutes: number;
  persistent?: boolean;
  cacheFile?: string;
}

interface CacheEntry {
  spec: LoadTestSpec;
  timestamp: number;
}

export class ParseCache {
  private config: ParseCacheConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheFilePath: string;

  constructor(config: ParseCacheConfig) {
    this.config = config;
    this.cacheFilePath =
      config.cacheFile || path.join(process.cwd(), "cache", "parse-cache.json");

    // Create cache directory if it doesn't exist
    const cacheDir = path.dirname(this.cacheFilePath);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Load persistent cache if enabled
    if (config.persistent !== false) {
      this.loadFromDisk();
    }
  }

  get(key: string): LoadTestSpec | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    const ttlMs = this.config.ttlMinutes * 60 * 1000;

    if (now - entry.timestamp > ttlMs) {
      this.cache.delete(key);
      this.saveToDisk(); // Save after cleanup
      return null;
    }

    return entry.spec;
  }

  set(key: string, spec: LoadTestSpec): void {
    // Check cache size limit
    if (this.cache.size >= this.config.maxSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      spec,
      timestamp: Date.now(),
    });

    // Save to disk if persistent
    if (this.config.persistent !== false) {
      this.saveToDisk();
    }
  }

  clear(): void {
    this.cache.clear();
    if (this.config.persistent !== false) {
      this.saveToDisk();
    }
  }

  size(): number {
    return this.cache.size;
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    const ttlMs = this.config.ttlMinutes * 60 * 1000;
    let cleaned = false;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > ttlMs) {
        this.cache.delete(key);
        cleaned = true;
      }
    }

    // Save to disk if we cleaned anything
    if (cleaned && this.config.persistent !== false) {
      this.saveToDisk();
    }
  }

  // Load cache from disk
  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const data = fs.readFileSync(this.cacheFilePath, "utf8");
        const cacheData = JSON.parse(data);

        // Convert back to Map
        this.cache = new Map(Object.entries(cacheData));

        console.log(`📁 Loaded ${this.cache.size} cached entries from disk`);

        // Clean expired entries on load
        this.cleanup();
      }
    } catch (error) {
      console.warn("⚠️ Failed to load cache from disk:", error);
      this.cache = new Map();
    }
  }

  // Save cache to disk
  private saveToDisk(): void {
    try {
      // Convert Map to object for JSON serialization
      const cacheObject = Object.fromEntries(this.cache);
      const data = JSON.stringify(cacheObject, null, 2);

      fs.writeFileSync(this.cacheFilePath, data, "utf8");

      if (process.env.NODE_ENV === "development") {
        console.log(`💾 Saved ${this.cache.size} cache entries to disk`);
      }
    } catch (error) {
      console.warn("⚠️ Failed to save cache to disk:", error);
    }
  }

  // Get cache file path
  getCacheFilePath(): string {
    return this.cacheFilePath;
  }

  // Get cache statistics
  getStats(): {
    size: number;
    filePath: string;
    persistent: boolean;
    maxSize: number;
    ttlMinutes: number;
  } {
    return {
      size: this.cache.size,
      filePath: this.cacheFilePath,
      persistent: this.config.persistent !== false,
      maxSize: this.config.maxSize,
      ttlMinutes: this.config.ttlMinutes,
    };
  }
}
