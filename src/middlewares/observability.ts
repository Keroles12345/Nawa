import { NextFunction, Request, Response } from 'express';

import { logger } from '../utils/logger';

export const observabilityMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    logger.info(`${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });

  next();
};
