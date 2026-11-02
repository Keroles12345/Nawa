import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ecommerce?schema=public',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET ?? 'development-jwt-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'development-refresh-secret',
  internalApiKey: process.env.INTERNAL_API_KEY ?? 'development-internal-key',
  bootstrapAdminName: process.env.ADMIN_NAME ?? 'Store Admin',
  bootstrapAdminEmail: process.env.ADMIN_EMAIL ?? '',
  bootstrapAdminPassword: process.env.ADMIN_PASSWORD ?? '',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  rateLimitWindowMinutes: Number(process.env.RATE_LIMIT_WINDOW_MINUTES ?? 15),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? (process.env.NODE_ENV === 'production' ? 100 : 1000)),
};
