import { afterEach, describe, expect, it } from 'vitest';
import {
  databaseEnvPresence,
  getPrismaMigrateShellCommand,
  resolveDatabaseUrl,
} from '../src/store/createStore.js';

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
});

describe('getPrismaMigrateShellCommand', () => {
  it('uses npx prisma migrate deploy without hardcoded .cmd or node_modules paths', () => {
    const command = getPrismaMigrateShellCommand();
    expect(command).toBe('npx prisma migrate deploy');
    expect(command).not.toContain('.cmd');
    expect(command).not.toContain('node_modules');
  });
});

describe('resolveDatabaseUrl', () => {
  it('prefers DATABASE_URL when set', () => {
    delete process.env.DATABASE_PRIVATE_URL;
    delete process.env.POSTGRES_URL;
    process.env.DATABASE_URL = 'postgresql://primary/db';
    expect(resolveDatabaseUrl()).toBe('postgresql://primary/db');
  });

  it('falls back to DATABASE_PRIVATE_URL (Railway internal URL)', () => {
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    process.env.DATABASE_PRIVATE_URL = 'postgresql://private/db';
    expect(resolveDatabaseUrl()).toBe('postgresql://private/db');
  });

  it('returns undefined when no database env is set', () => {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_PRIVATE_URL;
    delete process.env.POSTGRES_URL;
    expect(resolveDatabaseUrl()).toBeUndefined();
    expect(databaseEnvPresence()).toEqual({
      DATABASE_URL: false,
      DATABASE_PRIVATE_URL: false,
      POSTGRES_URL: false,
    });
  });
});
