import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { createMemoryStore } from './memoryStore.js';
import { createPostgresStore } from './postgresStore.js';
import { describeDatabaseHost, type StoreBundle } from './storeTypes.js';

const DATABASE_ENV_KEYS = ['DATABASE_URL', 'DATABASE_PRIVATE_URL', 'POSTGRES_URL'] as const;

function getRepoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../..');
}

const repoRoot = getRepoRoot();

/** Resolve Postgres URL from env (Railway may expose DATABASE_PRIVATE_URL only). */
export function resolveDatabaseUrl(): string | undefined {
  for (const key of DATABASE_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

/** Safe booleans for deploy logs — never log URL values. */
export function databaseEnvPresence(): Record<(typeof DATABASE_ENV_KEYS)[number], boolean> {
  return {
    DATABASE_URL: Boolean(process.env.DATABASE_URL?.trim()),
    DATABASE_PRIVATE_URL: Boolean(process.env.DATABASE_PRIVATE_URL?.trim()),
    POSTGRES_URL: Boolean(process.env.POSTGRES_URL?.trim()),
  };
}

function ensureDatabaseUrlForPrisma(resolvedUrl: string): void {
  if (!process.env.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = resolvedUrl;
  }
}

function getPrismaMigrateCommand(): { command: string; args: string[] } {
  const localBin = path.join(
    repoRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
  );
  if (fs.existsSync(localBin)) {
    return { command: localBin, args: ['migrate', 'deploy'] };
  }
  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['prisma', 'migrate', 'deploy'],
  };
}

export function runMigrationsSafe(): void {
  const { command, args } = getPrismaMigrateCommand();
  execFileSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export async function createStore(): Promise<StoreBundle> {
  const presence = databaseEnvPresence();
  // eslint-disable-next-line no-console
  console.log(
    `[SXM][store] DATABASE_URL present: ${presence.DATABASE_URL} DATABASE_PRIVATE_URL present: ${presence.DATABASE_PRIVATE_URL} POSTGRES_URL present: ${presence.POSTGRES_URL}`,
  );

  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    // eslint-disable-next-line no-console
    console.log('[SXM][store] selected store: memory (no database URL env — dev/test only)');
    return { store: createMemoryStore(), storeType: 'memory' };
  }

  ensureDatabaseUrlForPrisma(databaseUrl);

  // eslint-disable-next-line no-console
  console.log('[SXM][store] migration attempted: true');
  try {
    runMigrationsSafe();
    // eslint-disable-next-line no-console
    console.log('[SXM][store] migration success');
  } catch (err) {
    const execErr = err as NodeJS.ErrnoException & { stderr?: Buffer; stdout?: Buffer };
    const detail = execErr.stderr?.toString('utf8').trim() || execErr.message;
    // eslint-disable-next-line no-console
    console.error(`[SXM][store] migration failure: ${detail.slice(0, 500)}`);
    throw err;
  }

  const prisma = new PrismaClient();
  await prisma.$connect();
  // eslint-disable-next-line no-console
  console.log(
    `[SXM][store] selected store: postgres host=${describeDatabaseHost(databaseUrl)}`,
  );
  return {
    store: createPostgresStore(prisma),
    storeType: 'postgres',
    disconnect: () => prisma.$disconnect(),
  };
}

/** Test helper: connect to DATABASE_URL without running migrations. */
export async function createPostgresStoreForTests(): Promise<StoreBundle> {
  const databaseUrl = resolveDatabaseUrl() ?? process.env.TEST_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL, DATABASE_PRIVATE_URL, POSTGRES_URL, or TEST_DATABASE_URL required');
  }
  ensureDatabaseUrlForPrisma(databaseUrl);
  runMigrationsSafe();
  const prisma = new PrismaClient();
  await prisma.$connect();
  return {
    store: createPostgresStore(prisma),
    storeType: 'postgres',
    disconnect: () => prisma.$disconnect(),
  };
}
