import { RefreshTokenRecord } from '../types';
import { inMemoryRefreshTokens } from './inMemoryStore';

export const refreshTokenRepository = {
  findByToken: async (token: string): Promise<RefreshTokenRecord | undefined> =>
    inMemoryRefreshTokens.find((entry) => entry.token === token),
  create: async (entry: RefreshTokenRecord): Promise<RefreshTokenRecord> => {
    inMemoryRefreshTokens.push(entry);
    return entry;
  },
  revoke: async (token: string): Promise<void> => {
    const existing = inMemoryRefreshTokens.find((entry) => entry.token === token);
    if (existing) {
      existing.revoked = true;
    }
  },
};
