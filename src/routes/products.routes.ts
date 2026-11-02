import { Router } from 'express';

import { createProductController, deleteProductController, getProduct, getProducts, updateProductController } from '../controllers/products.controller';
import { authenticateToken, authorizeRole } from '../middlewares/auth';
import { validateRequest } from '../validators/request';
import { productSchema } from '../validators/products';

export const productsRouter = Router();
productsRouter.get('/', getProducts);
productsRouter.get('/:id', getProduct);
productsRouter.post('/', authenticateToken, authorizeRole('ADMIN'), validateRequest(productSchema), createProductController);
productsRouter.put('/:id', authenticateToken, authorizeRole('ADMIN'), validateRequest(productSchema), updateProductController);
productsRouter.delete('/:id', authenticateToken, authorizeRole('ADMIN'), deleteProductController);
