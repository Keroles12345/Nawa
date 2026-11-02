import { PrismaClient } from '@prisma/client';

import { config } from '../config';

export const prisma = new PrismaClient();

export const usePrisma = config.storageMode === 'prisma';

export function isPrismaEnabled(): boolean {
  return config.storageMode === 'prisma';
}
