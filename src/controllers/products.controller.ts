import { Request, Response } from 'express';

import { createProduct, deleteProduct, getProductById, listProducts, updateProduct } from '../services/product.service';

export async function getProducts(req: Request, res: Response): Promise<void> {
  try {
    const products = await listProducts();
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to fetch products' });
  }
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const product = await getProductById(id);
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to fetch product' });
  }
}

export async function createProductController(req: Request, res: Response): Promise<void> {
  try {
    const product = await createProduct(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to create product' });
  }
}

export async function updateProductController(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const product = await updateProduct(id, req.body);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Failed to update product' });
  }
}

export async function deleteProductController(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const removed = await deleteProduct(id);
    if (!removed) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to delete product' });
  }
}
