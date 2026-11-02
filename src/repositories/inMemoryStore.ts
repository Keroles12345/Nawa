import { Category, Order, Product, RefreshTokenRecord, User } from '../types';

export const inMemoryUsers: User[] = [];

export const inMemoryCategories: Category[] = [
  {
    id: 'category-electronics',
    name: 'Electronics',
    description: 'Electronic devices and gadgets',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'category-books',
    name: 'Books',
    description: 'Informational and entertainment books',
    createdAt: new Date().toISOString(),
  },
];

export const inMemoryProducts: Product[] = [
  {
    id: 'product-laptop',
    name: 'Laptop Pro 14',
    description: 'High performance laptop',
    price: 1299.99,
    categoryId: 'category-electronics',
    inventory: 12,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'product-book',
    name: 'Clean Architecture',
    description: 'Software architecture reference',
    price: 39.99,
    categoryId: 'category-books',
    inventory: 50,
    createdAt: new Date().toISOString(),
  },
];

export const inMemoryOrders: Order[] = [];

export const inMemoryRefreshTokens: RefreshTokenRecord[] = [];
