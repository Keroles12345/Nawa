import { Product } from '../types';
import { Prisma } from '@prisma/client';
import { prisma, usePrisma } from '../database/prisma';
import { inMemoryProducts } from './inMemoryStore';

function mapProduct(product: { id: string; name: string; description: string; price: { toNumber(): number }; categoryId: string; inventory: number; createdAt: Date }): Product {
  return { ...product, price: product.price.toNumber(), createdAt: product.createdAt.toISOString() };
}

export const productRepository = {
  findAll: async (): Promise<Product[]> => usePrisma
    ? (await prisma.product.findMany()).map(mapProduct)
    : [...inMemoryProducts],
  findById: async (id: string): Promise<Product | undefined> => {
    if (usePrisma) {
      const product = await prisma.product.findUnique({ where: { id } });
      return product ? mapProduct(product) : undefined;
    }
    return inMemoryProducts.find((product) => product.id === id);
  },
  create: async (product: Product): Promise<Product> => {
    if (usePrisma) {
      return mapProduct(await prisma.product.create({
        data: { ...product, createdAt: new Date(product.createdAt) },
      }));
    }
    inMemoryProducts.push(product);
    return product;
  },
  update: async (product: Product): Promise<Product> => {
    if (usePrisma) {
      return mapProduct(await prisma.product.update({
        where: { id: product.id },
        data: {
          name: product.name,
          description: product.description,
          price: product.price,
          categoryId: product.categoryId,
          inventory: product.inventory,
        },
      }));
    }
    const index = inMemoryProducts.findIndex((entry) => entry.id === product.id);
    if (index >= 0) {
      inMemoryProducts[index] = product;
      return product;
    }
    throw new Error('Product not found');
  },
  delete: async (id: string): Promise<boolean> => {
    if (usePrisma) {
      const result = await prisma.product.deleteMany({ where: { id } });
      return result.count > 0;
    }
    const index = inMemoryProducts.findIndex((product) => product.id === id);
    if (index >= 0) {
      inMemoryProducts.splice(index, 1);
      return true;
    }
    return false;
  },
  saveEmbedding: async (id: string, embedding: number[]): Promise<void> => {
    if (!usePrisma) {
      return;
    }
    const vector = `[${embedding.join(',')}]`;
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "Product" SET embedding = ${vector}::vector WHERE id = ${id}
    `);
  },
};
