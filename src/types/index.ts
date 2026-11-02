export type Role = 'ADMIN' | 'STAFF' | 'CUSTOMER';
export type TeamRole = Exclude<Role, 'CUSTOMER'>;
export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  inventory: number;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  total: number;
  items: OrderItem[];
  createdAt: string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  revoked: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface AuthUserPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
}

export interface CreateTeamUserInput extends CreateUserInput {
  role: TeamRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  categoryId: string;
  inventory: number;
}

export interface OrderInput {
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}
