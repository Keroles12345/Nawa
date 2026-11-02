import { Request, Response } from 'express';

import { createCategory, deleteCategory, listCategories, updateCategory } from '../services/category.service';

export async function getCategories(req: Request, res: Response): Promise<void> {
  try {
    const categories = await listCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to fetch categories' });
  }
}

export async function createCategoryController(req: Request, res: Response): Promise<void> {
  try {
    const category = await createCategory(req.body.name, req.body.description);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to create category' });
  }
}

export async function updateCategoryController(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const category = await updateCategory(id, req.body.name, req.body.description);
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Failed to update category' });
  }
}

export async function deleteCategoryController(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const removed = await deleteCategory(id);
    if (!removed) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to delete category' });
  }
}
