import { randomUUID } from 'crypto';

import { deleteCacheKey, getCacheValue, setCacheValue } from '../cache/redisClient';
import { productRepository } from '../repositories/product.repository';
import { getEmbeddingProvider } from '../search/embeddingProvider';
import { usePrisma } from '../database/prisma';
import { config } from '../config';
import { Product, ProductInput } from '../types';
import { logger } from '../utils/logger';

const PRODUCTS_CACHE_KEY = 'products:list';

export async function listProducts(): Promise<Product[]> {
  const cachedProducts = await getCacheValue<Product[]>(PRODUCTS_CACHE_KEY);
  if (cachedProducts) {
    return cachedProducts;
  }

  const products = await productRepository.findAll();
  await setCacheValue(PRODUCTS_CACHE_KEY, products, 3600);
  return products;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  return productRepository.findById(id);
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const product: Product = {
    id: randomUUID(),
    name: input.name,
    description: input.description,
    price: input.price,
    categoryId: input.categoryId,
    inventory: input.inventory,
    createdAt: new Date().toISOString(),
  };

  const createdProduct = await productRepository.create(product);
  await deleteCacheKey(PRODUCTS_CACHE_KEY);
  await indexProductEmbedding(createdProduct);
  return createdProduct;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
  const existingProduct = await productRepository.findById(id);
  if (!existingProduct) {
    throw new Error('Product not found');
  }

  const updatedProduct: Product = {
    ...existingProduct,
    ...input,
    id,
    createdAt: existingProduct.createdAt,
  };

  const product = await productRepository.update(updatedProduct);
  await deleteCacheKey(PRODUCTS_CACHE_KEY);
  await indexProductEmbedding(product);
  return product;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const removed = await productRepository.delete(id);
  await deleteCacheKey(PRODUCTS_CACHE_KEY);
  return removed;
}

export async function indexProductEmbedding(product: Product): Promise<void> {
  if (!usePrisma || !config.embeddingApiKey) {
    return;
  }
  try {
    const embedding = await getEmbeddingProvider().embed(`${product.name}\n${product.description}`);
    await productRepository.saveEmbedding(product.id, embedding);
  } catch (error) {
    logger.warn(`Could not update semantic embedding for product ${product.id}: ${String(error)}`);
  }
}
