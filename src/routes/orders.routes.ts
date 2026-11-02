import { Router } from 'express';

import { createOrderController, deleteOrderController, getMyOrdersController, getOrdersController, updateOrderController, updateOrderStatusController } from '../controllers/orders.controller';
import { authenticateToken, authorizeRole } from '../middlewares/auth';
import { validateRequest } from '../validators/request';
import { orderSchema, orderStatusSchema, updateOrderSchema } from '../validators/orders';

export const ordersRouter = Router();
ordersRouter.get('/mine', authenticateToken, getMyOrdersController);
ordersRouter.get('/', authenticateToken, authorizeRole('ADMIN', 'STAFF'), getOrdersController);
ordersRouter.put('/:id', authenticateToken, authorizeRole('ADMIN', 'STAFF'), validateRequest(updateOrderSchema), updateOrderController);
ordersRouter.delete('/:id', authenticateToken, authorizeRole('ADMIN', 'STAFF'), deleteOrderController);
ordersRouter.patch('/:id/status', authenticateToken, authorizeRole('ADMIN', 'STAFF'), validateRequest(orderStatusSchema), updateOrderStatusController);
ordersRouter.post('/', authenticateToken, validateRequest(orderSchema), createOrderController);
