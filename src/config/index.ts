import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? 'development';
const storageMode = nodeEnv === 'test' && process.env.RUN_PRISMA_INTEGRATION !== 'true'
  ? 'memory'
  : process.env.STORAGE_MODE ?? (nodeEnv === 'production' ? 'prisma' : 'memory');
const jwtSecret = process.env.JWT_SECRET ?? 'development-jwt-secret';
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET ?? 'development-refresh-secret';
const internalApiKey = process.env.INTERNAL_API_KEY ?? 'development-internal-key';

export function validateProductionEnvironment(environment: NodeJS.ProcessEnv): void {
  const missingOrWeakSecrets = [
    ['JWT_SECRET', environment.JWT_SECRET ?? ''],
    ['JWT_REFRESH_SECRET', environment.JWT_REFRESH_SECRET ?? ''],
    ['INTERNAL_API_KEY', environment.INTERNAL_API_KEY ?? ''],
  ].filter(([, value]) =>
    value.length < 32 ||
    value.startsWith('development-') ||
    value.startsWith('local-only-') ||
    value.startsWith('ci-only-'),
  );

  if (missingOrWeakSecrets.length > 0) {
    throw new Error(`Production requires unique secrets of at least 32 characters: ${missingOrWeakSecrets.map(([name]) => name).join(', ')}`);
  }
  if (new Set([environment.JWT_SECRET, environment.JWT_REFRESH_SECRET, environment.INTERNAL_API_KEY]).size !== 3) {
    throw new Error('JWT_SECRET, JWT_REFRESH_SECRET, and INTERNAL_API_KEY must all be different in production');
  }
  if (!environment.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production');
  }
  let databasePassword: string;
  try {
    databasePassword = decodeURIComponent(new URL(environment.DATABASE_URL).password);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL with a password');
  }
  if (databasePassword.length < 24 || /^(localOnly|local-only|development-|ci-only-)/i.test(databasePassword)) {
    throw new Error('Production DATABASE_URL must use a non-placeholder password of at least 24 characters');
  }
  if ((environment.STORAGE_MODE ?? 'prisma') !== 'prisma') {
    throw new Error('STORAGE_MODE must be prisma in production');
  }
}

if (nodeEnv === 'production') {
  validateProductionEnvironment(process.env);
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv,
  storageMode,
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ecommerce?schema=public',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret,
  jwtRefreshSecret,
  internalApiKey,
  embeddingApiUrl: process.env.EMBEDDING_API_URL ?? 'https://api.openai.com/v1/embeddings',
  embeddingApiKey: process.env.EMBEDDING_API_KEY ?? '',
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
  bootstrapAdminName: process.env.ADMIN_NAME ?? 'Store Admin',
  bootstrapAdminEmail: process.env.ADMIN_EMAIL ?? '',
  bootstrapAdminPassword: process.env.ADMIN_PASSWORD ?? '',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  rateLimitWindowMinutes: Number(process.env.RATE_LIMIT_WINDOW_MINUTES ?? 15),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? (process.env.NODE_ENV === 'production' ? 100 : 1000)),
};
