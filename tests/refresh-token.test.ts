import { logoutUser, refreshTokens, registerUser } from '../src/services/auth.service';
import { inMemoryRefreshTokens } from '../src/repositories/inMemoryStore';

describe('Refresh token persistence safety', () => {
  it('stores only a hash and atomically rotates and revokes refresh tokens', async () => {
    const result = await registerUser({
      name: 'Token Test',
      email: `refresh-${Date.now()}@example.test`,
      password: 'StrongPass123',
    });
    const originalRecord = inMemoryRefreshTokens.find((record) => record.userId === result.user.id);

    expect(originalRecord).toBeDefined();
    expect(originalRecord?.tokenHash).not.toBe(result.refreshToken);
    expect(originalRecord?.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    const rotated = await refreshTokens(result.refreshToken);
    expect(originalRecord?.revoked).toBe(true);

    const replacementRecord = inMemoryRefreshTokens.find((record) => record.userId === result.user.id && !record.revoked);
    expect(replacementRecord?.tokenHash).not.toBe(rotated.refreshToken);
    await expect(refreshTokens(result.refreshToken)).rejects.toThrow('Refresh token invalid');

    await logoutUser(rotated.refreshToken);
    expect(replacementRecord?.revoked).toBe(true);
  });
});
