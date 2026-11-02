import jwt from 'jsonwebtoken';

import { config } from '../config';
import { AuthUserPayload, Role } from '../types';

export function generateAccessToken(user: { id: string; email: string; role: Role }): string {
  const payload: AuthUserPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, config.jwtSecret, { expiresIn: '15m' });
}

export function generateRefreshToken(user: { id: string; email: string; role: Role }): string {
  const payload: AuthUserPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): AuthUserPayload {
  return jwt.verify(token, config.jwtSecret) as AuthUserPayload;
}

export function verifyRefreshToken(token: string): AuthUserPayload {
  return jwt.verify(token, config.jwtRefreshSecret) as AuthUserPayload;
}
