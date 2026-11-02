import { RefreshTokenRecord } from '../types';
import { prisma, usePrisma } from '../database/prisma';
import { inMemoryRefreshTokens } from './inMemoryStore';

function mapRefreshToken(record: {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
}): RefreshTokenRecord {
  return { ...record, expiresAt: record.expiresAt.toISOString() };
}

export const refreshTokenRepository = {
  findByTokenHash: async (tokenHash: string): Promise<RefreshTokenRecord | undefined> => {
    if (usePrisma) {
      const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
      return record ? mapRefreshToken(record) : undefined;
    }
    return inMemoryRefreshTokens.find((entry) => entry.tokenHash === tokenHash);
  },
  create: async (entry: RefreshTokenRecord): Promise<RefreshTokenRecord> => {
    if (usePrisma) {
      return mapRefreshToken(await prisma.refreshToken.create({
        data: { ...entry, expiresAt: new Date(entry.expiresAt) },
      }));
    }
    inMemoryRefreshTokens.push(entry);
    return entry;
  },
  rotate: async (oldTokenHash: string, replacement: RefreshTokenRecord): Promise<void> => {
    if (usePrisma) {
      await prisma.$transaction(async (transaction) => {
        const revoked = await transaction.refreshToken.updateMany({
          where: {
            tokenHash: oldTokenHash,
            revoked: false,
            expiresAt: { gt: new Date() },
          },
          data: { revoked: true },
        });
        if (revoked.count !== 1) {
          throw new Error('Refresh token invalid');
        }
        await transaction.refreshToken.create({
          data: { ...replacement, expiresAt: new Date(replacement.expiresAt) },
        });
      });
      return;
    }
    const existing = inMemoryRefreshTokens.find((entry) => entry.tokenHash === oldTokenHash);
    if (!existing || existing.revoked || new Date(existing.expiresAt).getTime() <= Date.now()) {
      throw new Error('Refresh token invalid');
    }
    existing.revoked = true;
    inMemoryRefreshTokens.push(replacement);
  },
  revoke: async (tokenHash: string): Promise<void> => {
    if (usePrisma) {
      await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } });
      return;
    }
    const existing = inMemoryRefreshTokens.find((entry) => entry.tokenHash === tokenHash);
    if (existing) {
      existing.revoked = true;
    }
  },
};
