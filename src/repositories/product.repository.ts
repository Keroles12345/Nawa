import { Product } from '../types';
import { inMemoryProducts } from './inMemoryStore';

export const productRepository = {
  findAll: async (): Promise<Product[]> => [...inMemoryProducts],
  findById: async (id: string): Promise<Product | undefined> => inMemoryProducts.find((product) => product.id === id),
  create: async (product: Product): Promise<Product> => {
    inMemoryProducts.push(product);
    return product;
  },
  update: async (product: Product): Promise<Product> => {
    const index = inMemoryProducts.findIndex((entry) => entry.id === product.id);
    if (index >= 0) {
      inMemoryProducts[index] = product;
      return product;
    }
    throw new Error('Product not found');
  },
  delete: async (id: string): Promise<boolean> => {
    const index = inMemoryProducts.findIndex((product) => product.id === id);
    if (index >= 0) {
      inMemoryProducts.splice(index, 1);
      return true;
    }
    return false;
  },
};
