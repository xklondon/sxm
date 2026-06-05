/**
 * Safe postinstall: skip when prisma/schema.prisma is absent (Docker layer cache),
 * and use a placeholder DATABASE_URL for generate when unset (Railway build phase).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const schemaPath = path.join(repoRoot, 'prisma', 'schema.prisma');

if (!fs.existsSync(schemaPath)) {
  // eslint-disable-next-line no-console
  console.log('[SXM][prisma] skip postinstall generate (schema not present yet)');
  process.exit(0);
}

if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = 'postgresql://build:build@127.0.0.1:5432/build';
}

const prismaBin = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);

execFileSync(prismaBin, ['generate'], {
  cwd: repoRoot,
  env: process.env,
  stdio: 'inherit',
});
