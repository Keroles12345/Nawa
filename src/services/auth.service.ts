import { createHash, randomUUID } from 'crypto';

import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../auth/jwt';
import { hashPassword, verifyPassword } from '../auth/password';
import { config } from '../config';
import { refreshTokenRepository } from '../repositories/refreshToken.repository';
import { userRepository } from '../repositories/user.repository';
import { CreateUserInput, LoginInput, RefreshTokenRecord, Role, User } from '../types';

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createRefreshTokenRecord(userId: string, token: string): RefreshTokenRecord {
  return {
    id: randomUUID(),
    userId,
    tokenHash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    revoked: false,
  };
}

export function sanitizeUser(user: User): Omit<User, 'passwordHash'> {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function ensureBootstrapAdmin(): Promise<void> {
  const { bootstrapAdminEmail, bootstrapAdminName, bootstrapAdminPassword } = config;

  if (!bootstrapAdminEmail && !bootstrapAdminPassword) {
    return;
  }

  if (!bootstrapAdminEmail || bootstrapAdminPassword.length < 8) {
    throw new Error('Set both ADMIN_EMAIL and an ADMIN_PASSWORD of at least 8 characters to create the admin account');
  }

  const existingUser = await userRepository.findByEmail(bootstrapAdminEmail);
  if (existingUser) {
    if (existingUser.role !== 'ADMIN') {
      throw new Error('ADMIN_EMAIL is already registered to a non-admin account');
    }
    return;
  }

  const now = new Date().toISOString();
  await userRepository.create({
    id: randomUUID(),
    name: bootstrapAdminName,
    email: bootstrapAdminEmail,
    passwordHash: await hashPassword(bootstrapAdminPassword),
    role: 'ADMIN',
    createdAt: now,
    updatedAt: now,
  });
}

function getLoginAttempts(email: string): { count: number; resetAt: number } | undefined {
  const now = Date.now();
  const current = loginAttempts.get(email.toLowerCase());

  if (!current) {
    return undefined;
  }

  if (now >= current.resetAt) {
    loginAttempts.delete(email.toLowerCase());
    return undefined;
  }

  return current;
}

export async function registerUser(input: CreateUserInput): Promise<{ user: Omit<User, 'passwordHash'>; accessToken: string; refreshToken: string }> {
  const existing = await userRepository.findByEmail(input.email);
  if (existing) {
    throw new Error('User already exists');
  }

  const passwordHash = await hashPassword(input.password);
  const user: User = {
    id: randomUUID(),
    name: input.name,
    email: input.email,
    passwordHash,
    role: 'CUSTOMER' as Role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await userRepository.create(user);
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await refreshTokenRepository.create(createRefreshTokenRecord(user.id, refreshToken));

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
}

export async function loginUser(input: LoginInput): Promise<{ user: Omit<User, 'passwordHash'>; accessToken: string; refreshToken: string }> {
  const normalizedEmail = input.email.toLowerCase();
  const currentAttempts = getLoginAttempts(normalizedEmail);

  if (currentAttempts && currentAttempts.count >= 5) {
    throw new Error('Too many login attempts. Please try again later.');
  }

  const user = await userRepository.findByEmail(input.email);
  if (!user) {
    const attempts = currentAttempts ?? { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
    attempts.count += 1;
    loginAttempts.set(normalizedEmail, attempts);
    throw new Error('Invalid email or password');
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    const attempts = currentAttempts ?? { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
    attempts.count += 1;
    loginAttempts.set(normalizedEmail, attempts);
    throw new Error('Invalid email or password');
  }

  loginAttempts.delete(normalizedEmail);

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await refreshTokenRepository.create(createRefreshTokenRecord(user.id, refreshToken));

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
}

export async function refreshTokens(refreshTokenValue: string): Promise<{ accessToken: string; refreshToken: string }> {
  const payload = verifyRefreshToken(refreshTokenValue);
  const tokenHash = hashRefreshToken(refreshTokenValue);
  const storedRefreshToken = await refreshTokenRepository.findByTokenHash(tokenHash);

  if (!storedRefreshToken || storedRefreshToken.revoked || new Date(storedRefreshToken.expiresAt).getTime() <= Date.now() ||
    storedRefreshToken.userId !== payload.sub) {
    throw new Error('Refresh token invalid');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user) {
    throw new Error('User not found');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await refreshTokenRepository.rotate(tokenHash, createRefreshTokenRecord(user.id, refreshToken));

  return { accessToken, refreshToken };
}

export async function logoutUser(refreshTokenValue: string): Promise<void> {
  await refreshTokenRepository.revoke(hashRefreshToken(refreshTokenValue));
}
