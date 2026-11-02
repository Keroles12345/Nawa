import { Prisma } from '@prisma/client';

import { config } from '../config';
import { isPrismaEnabled, prisma } from '../database/prisma';
import { getEmbeddingProvider } from '../search/embeddingProvider';
import { Product } from '../types';
import { logger } from '../utils/logger';
import { indexProductEmbedding, listProducts } from './product.service';

interface ProductSearchRow {
  id: string;
  name: string;
  description: string;
  price: Prisma.Decimal;
  categoryId: string;
  inventory: number;
  createdAt: Date;
}

export async function searchProducts(query: string): Promise<Product[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2 || normalizedQuery.length > 500) {
    throw new Error('Search query must be between 2 and 500 characters');
  }

  if (!isPrismaEnabled()) {
    logger.warn('Semantic product search requires PostgreSQL; returning the standard product catalog');
    return listProducts();
  }

  try {
    const embedding = await getEmbeddingProvider().embed(normalizedQuery);
    const vector = `[${embedding.join(',')}]`;
    const results = await prisma.$queryRaw<ProductSearchRow[]>(Prisma.sql`
      SELECT id, name, description, price, "categoryId", inventory, "createdAt"
      FROM "Product"
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vector}::vector
      LIMIT 20
    `);
    if (results.length === 0) {
      return listProducts();
    }
    return results.map((product) => ({
      ...product,
      price: product.price.toNumber(),
      createdAt: product.createdAt.toISOString(),
    }));
  } catch (error) {
    logger.warn(`Semantic search unavailable; returning the standard product catalog: ${String(error)}`);
    return listProducts();
  }
}

export async function indexMissingProductEmbeddings(): Promise<void> {
  if (!isPrismaEnabled() || !config.embeddingApiKey) {
    return;
  }

  const missingProducts = await prisma.$queryRaw<ProductSearchRow[]>(Prisma.sql`
    SELECT id, name, description, price, "categoryId", inventory, "createdAt"
    FROM "Product"
    WHERE embedding IS NULL
    LIMIT 50
  `);
  for (const product of missingProducts) {
    await indexProductEmbedding({
      ...product,
      price: product.price.toNumber(),
      createdAt: product.createdAt.toISOString(),
    });
  }
}
