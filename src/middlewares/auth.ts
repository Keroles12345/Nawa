import { NextFunction, Request, Response } from 'express';

import { verifyAccessToken } from '../auth/jwt';
import { config } from '../config';
import { Role } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    email: string;
    role: Role;
  };
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ success: false, message: 'Missing bearer token' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export function authorizeRole(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user || !allowedRoles.includes(user.role)) {
      res.status(403).json({ success: false, message: 'Forbidden: insufficient role' });
      return;
    }

    next();
  };
}

export function requireAPIKey(req: Request, res: Response, next: NextFunction): void {
  const providedKey = req.headers['x-api-key'];

  if (typeof providedKey !== 'string' || providedKey !== config.internalApiKey) {
    res.status(401).json({ success: false, message: 'Missing or invalid API key' });
    return;
  }

  next();
}
