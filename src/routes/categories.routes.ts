import { Router } from 'express';

import { createCategoryController, deleteCategoryController, getCategories, updateCategoryController } from '../controllers/categories.controller';
import { authenticateToken, authorizeRole } from '../middlewares/auth';

export const categoriesRouter = Router();
categoriesRouter.get('/', getCategories);
categoriesRouter.post('/', authenticateToken, authorizeRole('ADMIN'), createCategoryController);
categoriesRouter.put('/:id', authenticateToken, authorizeRole('ADMIN'), updateCategoryController);
categoriesRouter.delete('/:id', authenticateToken, authorizeRole('ADMIN'), deleteCategoryController);
