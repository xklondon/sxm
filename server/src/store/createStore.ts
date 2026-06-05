import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { createMemoryStore } from './memoryStore.js';
import { createPostgresStore } from './postgresStore.js';
import { describeDatabaseHost, type StoreBundle } from './storeTypes.js';

const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../../..');

export function runMigrationsSafe(): void {
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'migrate', 'deploy'], {
    cwd: repoRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export async function createStore(): Promise<StoreBundle> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    // eslint-disable-next-line no-console
    console.log('[SXM][store] Using in-memory store (DATABASE_URL not set — dev/test only)');
    return { store: createMemoryStore(), storeType: 'memory' };
  }

  runMigrationsSafe();
  const prisma = new PrismaClient();
  await prisma.$connect();
  // eslint-disable-next-line no-console
  console.log(
    `[SXM][store] Using postgres store provider=postgresql host=${describeDatabaseHost(databaseUrl)}`,
  );
  return {
    store: createPostgresStore(prisma),
    storeType: 'postgres',
    disconnect: () => prisma.$disconnect(),
  };
}

/** Test helper: connect to DATABASE_URL without running migrations. */
export async function createPostgresStoreForTests(): Promise<StoreBundle> {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? process.env.TEST_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL or TEST_DATABASE_URL required for postgres store tests');
  }
  process.env.DATABASE_URL = databaseUrl;
  runMigrationsSafe();
  const prisma = new PrismaClient();
  await prisma.$connect();
  return {
    store: createPostgresStore(prisma),
    storeType: 'postgres',
    disconnect: () => prisma.$disconnect(),
  };
}
