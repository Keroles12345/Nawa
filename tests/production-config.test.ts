import { validateProductionEnvironment } from '../src/config';

describe('Production configuration', () => {
  const validEnvironment: NodeJS.ProcessEnv = {
    DATABASE_URL: `postgresql://nawa:${'d'.repeat(32)}@postgres:5432/ecommerce`,
    STORAGE_MODE: 'prisma',
    JWT_SECRET: 'a'.repeat(48),
    JWT_REFRESH_SECRET: 'b'.repeat(48),
    INTERNAL_API_KEY: 'c'.repeat(48),
  };

  it('accepts distinct strong secrets and a persistent database configuration', () => {
    expect(() => validateProductionEnvironment(validEnvironment)).not.toThrow();
  });

  it('rejects missing, weak, or reused secrets and non-Prisma storage', () => {
    expect(() => validateProductionEnvironment({ ...validEnvironment, JWT_SECRET: 'weak' })).toThrow('JWT_SECRET');
    expect(() => validateProductionEnvironment({
      ...validEnvironment,
      INTERNAL_API_KEY: validEnvironment.JWT_SECRET,
    })).toThrow('must all be different');
    expect(() => validateProductionEnvironment({ ...validEnvironment, STORAGE_MODE: 'memory' })).toThrow('STORAGE_MODE');
    expect(() => validateProductionEnvironment({
      ...validEnvironment,
      DATABASE_URL: 'postgresql://nawa:localOnlyChangeThisPassword123@postgres:5432/ecommerce',
    })).toThrow('placeholder password');
  });
});
