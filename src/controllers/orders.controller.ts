import { Request, Response } from 'express';

import { AuthenticatedRequest } from '../middlewares/auth';
import { createOrder, deleteOrder, listOrders, listUserOrders, updateOrder, updateOrderStatus } from '../services/order.service';

export async function getOrdersController(_req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json({ success: true, data: await listOrders() });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to fetch orders' });
  }
}

export async function getMyOrdersController(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    res.status(200).json({ success: true, data: await listUserOrders(req.user!.sub) });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to fetch orders' });
  }
}

export async function createOrderController(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (req.user!.role !== 'CUSTOMER' && !req.body.userId) {
      res.status(400).json({ success: false, message: 'Customer is required' });
      return;
    }
    const input = {
      ...req.body,
      userId: req.user!.role === 'CUSTOMER' ? req.user!.sub : req.body.userId,
    };
    const result = await createOrder(input);
    res.status(202).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Failed to create order' });
  }
}

export async function updateOrderController(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const order = await updateOrder(id, req.body);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Failed to update order' });
  }
}

export async function deleteOrderController(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    if (!(await deleteOrder(id))) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to delete order' });
  }
}

export async function updateOrderStatusController(req: Request, res: Response): Promise<void> {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const order = await updateOrderStatus(id, req.body.status);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Failed to update order' });
  }
}
