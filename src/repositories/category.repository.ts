import { Category } from '../types';
import { inMemoryCategories } from './inMemoryStore';

export const categoryRepository = {
  findAll: async (): Promise<Category[]> => [...inMemoryCategories],
  findById: async (id: string): Promise<Category | undefined> => inMemoryCategories.find((category) => category.id === id),
  create: async (category: Category): Promise<Category> => {
    inMemoryCategories.push(category);
    return category;
  },
  update: async (category: Category): Promise<Category> => {
    const index = inMemoryCategories.findIndex((entry) => entry.id === category.id);
    if (index >= 0) {
      inMemoryCategories[index] = category;
      return category;
    }
    throw new Error('Category not found');
  },
  delete: async (id: string): Promise<boolean> => {
    const index = inMemoryCategories.findIndex((category) => category.id === id);
    if (index >= 0) {
      inMemoryCategories.splice(index, 1);
      return true;
    }
    return false;
  },
};
