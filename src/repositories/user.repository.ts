import { User } from '../types';
import { inMemoryUsers } from './inMemoryStore';

export const userRepository = {
  findAll: async (): Promise<User[]> => inMemoryUsers,
  findByEmail: async (email: string): Promise<User | undefined> =>
    inMemoryUsers.find((user) => user.email.toLowerCase() === email.toLowerCase()),
  findById: async (id: string): Promise<User | undefined> => inMemoryUsers.find((user) => user.id === id),
  create: async (user: User): Promise<User> => {
    inMemoryUsers.push(user);
    return user;
  },
  update: async (user: User): Promise<User> => {
    const index = inMemoryUsers.findIndex((entry) => entry.id === user.id);
    if (index >= 0) {
      inMemoryUsers[index] = user;
      return user;
    }
    throw new Error('User not found');
  },
};
