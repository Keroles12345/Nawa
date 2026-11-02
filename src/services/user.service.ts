import { randomUUID } from 'crypto';

import { hashPassword } from '../auth/password';
import { userRepository } from '../repositories/user.repository';
import { CreateTeamUserInput, CreateUserInput, Role, User } from '../types';

export class UserAlreadyExistsError extends Error {
  constructor() {
    super('A user with this email already exists');
  }
}

export async function createCustomer(input: CreateUserInput): Promise<Omit<User, 'passwordHash'>> {
  return createUser(input, 'CUSTOMER');
}

export async function createTeamUser(input: CreateTeamUserInput): Promise<Omit<User, 'passwordHash'>> {
  return createUser(input, input.role);
}

async function createUser(input: CreateUserInput, role: Role): Promise<Omit<User, 'passwordHash'>> {
  if (await userRepository.findByEmail(input.email)) {
    throw new UserAlreadyExistsError();
  }

  const now = new Date().toISOString();
  const user: User = {
    id: randomUUID(),
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role,
    createdAt: now,
    updatedAt: now,
  };
  await userRepository.create(user);
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function listUsers(): Promise<Omit<User, 'passwordHash'>[]> {
  const users = await userRepository.findAll();
  return users.map(({ passwordHash, ...user }) => user);
}

export async function getUserById(id: string): Promise<Omit<User, 'passwordHash'> | undefined> {
  const user = await userRepository.findById(id);
  if (!user) {
    return undefined;
  }

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}
