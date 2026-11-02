import { randomUUID } from 'crypto';

import { deleteCacheKey, getCacheValue, setCacheValue } from '../cache/redisClient';
import { productRepository } from '../repositories/product.repository';
import { Product, ProductInput } from '../types';

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
  return product;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const removed = await productRepository.delete(id);
  await deleteCacheKey(PRODUCTS_CACHE_KEY);
  return removed;
}
