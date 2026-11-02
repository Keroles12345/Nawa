import { User } from '../types';
import { prisma, usePrisma } from '../database/prisma';
import { inMemoryUsers } from './inMemoryStore';

function mapUser(user: { id: string; name: string; email: string; passwordHash: string; role: User['role']; createdAt: Date; updatedAt: Date }): User {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export const userRepository = {
  findAll: async (): Promise<User[]> => {
    if (usePrisma) {
      return (await prisma.user.findMany()).map(mapUser);
    }
    return inMemoryUsers;
  },
  findByEmail: async (email: string): Promise<User | undefined> => {
    if (usePrisma) {
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      return user ? mapUser(user) : undefined;
    }
    return inMemoryUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());
  },
  findById: async (id: string): Promise<User | undefined> => {
    if (usePrisma) {
      const user = await prisma.user.findUnique({ where: { id } });
      return user ? mapUser(user) : undefined;
    }
    return inMemoryUsers.find((user) => user.id === id);
  },
  create: async (user: User): Promise<User> => {
    if (usePrisma) {
      return mapUser(await prisma.user.create({
        data: {
          ...user,
          email: user.email.toLowerCase(),
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        },
      }));
    }
    inMemoryUsers.push(user);
    return user;
  },
  update: async (user: User): Promise<User> => {
    if (usePrisma) {
      return mapUser(await prisma.user.update({
        where: { id: user.id },
        data: {
          name: user.name,
          email: user.email.toLowerCase(),
          passwordHash: user.passwordHash,
          role: user.role,
          updatedAt: new Date(user.updatedAt),
        },
      }));
    }
    const index = inMemoryUsers.findIndex((entry) => entry.id === user.id);
    if (index >= 0) {
      inMemoryUsers[index] = user;
      return user;
    }
    throw new Error('User not found');
  },
};
