const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const DEFAULT_TTL_SECONDS = 300; // 5 menit

// In-memory fallback jika Redis sedang offline atau bermasalah
const memoryFallback = new Map();

let redis = null;
let isRedisConnected = false;

try {
  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    connectTimeout: 5000,
    retryStrategy(times) {
      if (times > 5) {
        console.warn('⚠️ [Redis] Gagal terhubung setelah 5 percobaan. Menggunakan memory fallback.');
        return null;
      }
      return Math.min(times * 500, 2000);
    }
  });

  redis.on('connect', () => {
    console.log(`🔌 [Redis] Menghubungi Redis Server di ${REDIS_URL.replace(/:[^:@]+@/, ':***@')}`);
  });

  redis.on('ready', () => {
    isRedisConnected = true;
    console.log('⚡ [Redis] Siap dan aktif untuk caching data!');
  });

  redis.on('error', (err) => {
    isRedisConnected = false;
    console.warn(`⚠️ [Redis Error] ${err.message}. Beralih sementara ke in-memory cache.`);
  });

  redis.on('close', () => {
    isRedisConnected = false;
  });
} catch (e) {
  console.warn('⚠️ [Redis Init Error]:', e.message);
  isRedisConnected = false;
}

class CacheService {
  constructor(defaultTTLSeconds = DEFAULT_TTL_SECONDS) {
    this.defaultTTL = defaultTTLSeconds;
  }

  isConnected() {
    return isRedisConnected;
  }

  getStoreType() {
    return isRedisConnected ? 'Redis' : 'Memory';
  }

  async get(key) {
    if (isRedisConnected && redis) {
      try {
        const raw = await redis.get(key);
        if (raw) {
          return JSON.parse(raw);
        }
        return null;
      } catch (err) {
        console.warn(`[Redis Get Error] ${key}:`, err.message);
      }
    }

    // Fallback in-memory
    const item = memoryFallback.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      memoryFallback.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key, value, ttlSeconds = this.defaultTTL) {
    // 1. Simpan ke Redis jika aktif
    if (isRedisConnected && redis) {
      try {
        const serialized = JSON.stringify(value);
        await redis.set(key, serialized, 'EX', ttlSeconds);
      } catch (err) {
        console.warn(`[Redis Set Error] ${key}:`, err.message);
      }
    }

    // 2. Simpan juga ke in-memory fallback
    memoryFallback.set(key, {
      value,
      expiry: Date.now() + (ttlSeconds * 1000),
      cachedAt: new Date().toISOString()
    });
  }

  async delete(key) {
    memoryFallback.delete(key);
    if (isRedisConnected && redis) {
      try {
        await redis.del(key);
      } catch (err) {
        console.warn(`[Redis Del Error] ${key}:`, err.message);
      }
    }
  }

  async invalidatePrefix(prefix) {
    let deletedCount = 0;

    // Bersihkan in-memory
    for (const key of memoryFallback.keys()) {
      if (key.startsWith(prefix)) {
        memoryFallback.delete(key);
        deletedCount++;
      }
    }

    // Bersihkan Redis
    if (isRedisConnected && redis) {
      try {
        const keys = await redis.keys(`${prefix}*`);
        if (keys && keys.length > 0) {
          await redis.del(...keys);
          deletedCount = Math.max(deletedCount, keys.length);
        }
      } catch (err) {
        console.warn(`[Redis Invalidate Error] ${prefix}:`, err.message);
      }
    }

    return deletedCount;
  }

  async clear() {
    memoryFallback.clear();
    if (isRedisConnected && redis) {
      try {
        await redis.flushdb();
      } catch (err) {
        console.warn('[Redis Clear Error]:', err.message);
      }
    }
  }

  async getStats() {
    let redisKeys = [];
    if (isRedisConnected && redis) {
      try {
        redisKeys = await redis.keys('*');
      } catch (e) {}
    }

    return {
      connected: isRedisConnected,
      store: this.getStoreType(),
      redisUrl: REDIS_URL.replace(/:[^:@]+@/, ':***@'),
      totalKeysInRedis: redisKeys.length,
      keys: redisKeys,
      memoryFallbackSize: memoryFallback.size
    };
  }
}

const cacheService = new CacheService(DEFAULT_TTL_SECONDS);

module.exports = {
  redis,
  cacheService
};
