import { z } from 'zod';

export const orderSchema = z.object({
  userId: z.string().min(1).optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().positive(),
    }),
  ).min(1),
});

export const orderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED']),
});

export const updateOrderSchema = z.object({
  userId: z.string().min(1).optional(),
  items: orderSchema.shape.items.optional(),
  status: orderStatusSchema.shape.status.optional(),
}).refine((input) => Object.values(input).some((value) => value !== undefined), {
  message: 'At least one order field must be provided',
});
