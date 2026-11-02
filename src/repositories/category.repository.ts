import { Category } from '../types';
import { prisma, usePrisma } from '../database/prisma';
import { inMemoryCategories } from './inMemoryStore';

function mapCategory(category: { id: string; name: string; description: string | null; createdAt: Date }): Category {
  return {
    ...category,
    description: category.description ?? '',
    createdAt: category.createdAt.toISOString(),
  };
}

export const categoryRepository = {
  findAll: async (): Promise<Category[]> => usePrisma
    ? (await prisma.category.findMany()).map(mapCategory)
    : [...inMemoryCategories],
  findById: async (id: string): Promise<Category | undefined> => {
    if (usePrisma) {
      const category = await prisma.category.findUnique({ where: { id } });
      return category ? mapCategory(category) : undefined;
    }
    return inMemoryCategories.find((category) => category.id === id);
  },
  create: async (category: Category): Promise<Category> => {
    if (usePrisma) {
      return mapCategory(await prisma.category.create({
        data: { ...category, createdAt: new Date(category.createdAt) },
      }));
    }
    inMemoryCategories.push(category);
    return category;
  },
  update: async (category: Category): Promise<Category> => {
    if (usePrisma) {
      return mapCategory(await prisma.category.update({
        where: { id: category.id },
        data: { name: category.name, description: category.description },
      }));
    }
    const index = inMemoryCategories.findIndex((entry) => entry.id === category.id);
    if (index >= 0) {
      inMemoryCategories[index] = category;
      return category;
    }
    throw new Error('Category not found');
  },
  delete: async (id: string): Promise<boolean> => {
    if (usePrisma) {
      const result = await prisma.category.deleteMany({ where: { id } });
      return result.count > 0;
    }
    const index = inMemoryCategories.findIndex((category) => category.id === id);
    if (index >= 0) {
      inMemoryCategories.splice(index, 1);
      return true;
    }
    return false;
  },
};
