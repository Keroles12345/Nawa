import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(5),
  price: z.number().positive(),
  categoryId: z.string().min(1),
  inventory: z.number().int().nonnegative(),
});
