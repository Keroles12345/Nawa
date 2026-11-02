import { createClient, RedisClientType } from 'redis';

import { config } from '../config';
import { logger } from '../utils/logger';

export const redisClient: RedisClientType = createClient({
  url: config.redisUrl,
}) as RedisClientType;

redisClient.on('error', (error: unknown) => {
  logger.warn(`Redis unavailable: ${String(error)}`);
});

redisClient.on('connect', () => {
  logger.info('Redis connected successfully');
});

export async function connectRedis(): Promise<boolean> {
  try {
    await redisClient.connect();
    return true;
  } catch (error) {
    logger.warn(`Redis connection failed: ${String(error)}`);
    return false;
  }
}

export function isRedisAvailable(): boolean {
  return redisClient.isReady;
}

export async function getCacheValue<T>(key: string): Promise<T | null> {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const rawValue = await redisClient.get(key);
    if (!rawValue) {
      return null;
    }
    return JSON.parse(rawValue) as T;
  } catch (error) {
    logger.warn(`Cache read failed for ${key}: ${String(error)}`);
    return null;
  }
}

export async function setCacheValue<T>(key: string, value: T, ttlSeconds = 3600): Promise<void> {
  if (!isRedisAvailable()) {
    return;
  }

  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    logger.warn(`Cache write failed for ${key}: ${String(error)}`);
  }
}

export async function deleteCacheKey(key: string): Promise<void> {
  if (!isRedisAvailable()) {
    return;
  }

  try {
    await redisClient.del(key);
  } catch (error) {
    logger.warn(`Cache delete failed for ${key}: ${String(error)}`);
  }
}

export async function incrementRateLimit(key: string, windowSeconds: number, maxRequests: number): Promise<{ remaining: number; blocked: boolean }> {
  if (!isRedisAvailable()) {
    return { remaining: 0, blocked: false };
  }

  try {
    const current = await redisClient.incr(key);
    if (current === 1) {
      await redisClient.expire(key, windowSeconds);
    }
    const ttl = await redisClient.ttl(key);
    const remaining = Math.max(0, maxRequests - current);
    return { remaining: ttl > 0 ? remaining : 0, blocked: current > maxRequests };
  } catch (error) {
    logger.warn(`Rate limit check failed for ${key}: ${String(error)}`);
    return { remaining: 0, blocked: true };
  }
}
