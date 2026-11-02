import { Prisma } from '@prisma/client';

import { config } from '../src/config';
import { prisma } from '../src/database/prisma';
import { setEmbeddingProvider } from '../src/search/embeddingProvider';
import { searchProducts } from '../src/services/search.service';

describe('Semantic product search', () => {
  it('uses the configured embedding provider and returns vector-ranked products', async () => {
    const previousStorageMode = config.storageMode;
    config.storageMode = 'prisma';
    const embed = jest.fn().mockResolvedValue(Array.from({ length: 1536 }, () => 0.25));
    const restoreProvider = setEmbeddingProvider({ embed });
    const query = jest.spyOn(prisma, '$queryRaw').mockResolvedValue([{
      id: 'product-1',
      name: 'Warm jacket',
      description: 'Insulated outdoor clothing',
      price: new Prisma.Decimal('42.50'),
      categoryId: 'clothing',
      inventory: 7,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }] as never);

    try {
      const results = await searchProducts('warm winter clothing');
      expect(embed).toHaveBeenCalledWith('warm winter clothing');
      expect(results).toHaveLength(1);
      expect(results[0].price).toBe(42.5);
    } finally {
      config.storageMode = previousStorageMode;
      restoreProvider();
      query.mockRestore();
    }
  });
});
