let redis = null;

try {
  const Redis = require('ioredis');
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASS || undefined,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 2) return null;
      return Math.min(times * 500, 2000);
    },
    lazyConnect: true,
  });

  redis.connect().then(() => {
    console.log('✅ Redis connected');
  }).catch(() => {
    console.log('⚠️ Redis ไม่พร้อม — ทำงานแบบไม่มี cache');
    redis = null;
  });

  redis.on('error', () => {
    redis = null;
  });
} catch {
  console.log('⚠️ Redis ไม่พร้อม — ทำงานแบบไม่มี cache');
}

const CACHE_TTL = 30;

async function getCache(key) {
  if (!redis) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

async function setCache(key, data, ttl = CACHE_TTL) {
  if (!redis) return;
  try { await redis.setex(key, ttl, JSON.stringify(data)); } catch {}
}

async function clearCache(pattern) {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern || 'cache:*');
    if (keys.length > 0) await redis.del(...keys);
  } catch {}
}

module.exports = { getCache, setCache, clearCache };
