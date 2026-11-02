import { NextFunction, Request, Response } from 'express';

import { incrementRateLimit, isRedisAvailable } from '../cache/redisClient';

const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();

export function redisRateLimiter(windowMs = 15 * 60 * 1000, maxRequests = 100) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.path.startsWith('/api/')) {
      next();
      return;
    }

    const key = req.ip ?? 'unknown-client';
    const windowSeconds = Math.ceil(windowMs / 1000);

    const handleMemoryLimit = (): void => {
      const now = Date.now();
      const current = memoryRateLimits.get(key);

      if (!current || now >= current.resetAt) {
        memoryRateLimits.set(key, { count: 1, resetAt: now + windowMs });
        res.setHeader('X-RateLimit-Limit', String(maxRequests));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - 1)));
        next();
        return;
      }

      if (current.count >= maxRequests) {
        res.setHeader('X-RateLimit-Limit', String(maxRequests));
        res.setHeader('X-RateLimit-Remaining', '0');
        res.status(429).json({ success: false, message: 'Too many requests' });
        return;
      }

      current.count += 1;
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - current.count)));
      next();
    };

    if (!isRedisAvailable()) {
      handleMemoryLimit();
      return;
    }

    try {
      const result = await incrementRateLimit(`rate-limit:${key}`, windowSeconds, maxRequests);
      if (result.blocked) {
        res.setHeader('X-RateLimit-Limit', String(maxRequests));
        res.setHeader('X-RateLimit-Remaining', '0');
        res.status(429).json({ success: false, message: 'Too many requests' });
        return;
      }

      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      next();
    } catch (error) {
      handleMemoryLimit();
    }
  };
}
