import { randomUUID } from 'crypto';

import { categoryRepository } from '../repositories/category.repository';
import { Category } from '../types';

export async function listCategories(): Promise<Category[]> {
  return categoryRepository.findAll();
}

export async function createCategory(name: string, description: string): Promise<Category> {
  const category: Category = {
    id: randomUUID(),
    name,
    description,
    createdAt: new Date().toISOString(),
  };

  return categoryRepository.create(category);
}

export async function updateCategory(id: string, name: string, description: string): Promise<Category> {
  const existing = await categoryRepository.findById(id);
  if (!existing) {
    throw new Error('Category not found');
  }

  return categoryRepository.update({
    ...existing,
    name,
    description,
  });
}

export async function deleteCategory(id: string): Promise<boolean> {
  return categoryRepository.delete(id);
}
