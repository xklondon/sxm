/**
 * Environment file safety — scripts must never overwrite .env secrets automatically.
 * Only writeEnvWithGuard() may touch .env, and only when --write-env is passed.
 */
import fs from 'node:fs';
import path from 'node:path';

export const PROTECTED_ENV_KEYS = [
  'SMTP_PASS',
  'SESSION_SECRET',
  'SMTP_USER',
  'RESEND_API_KEY',
] as const;

export const RECOMMENDED_ENV_KEYS = [
  'PUBLIC_ORIGIN',
  'CORS_ORIGIN',
  'VITE_API_URL',
  'VITE_TABLE_HOST',
  'VITE_ONLINE_MODE',
  'API_PORT',
] as const;

const ROOT_ENV = path.resolve(process.cwd(), '.env');
const GENERATED_ENV = path.resolve(process.cwd(), '.env.local.generated');

export function hasWriteEnvFlag(argv: string[] = process.argv): boolean {
  return argv.includes('--write-env');
}

/** Abort unless caller explicitly passed --write-env. */
export function assertEnvWriteAllowed(): void {
  if (!hasWriteEnvFlag()) {
    throw new Error(
      'Refusing to write .env without --write-env. Add keys manually or use writeEnvLocalGenerated() for non-secret patches.',
    );
  }
}

/** Document that a script is read-only with respect to .env (no writes). */
export function assertEnvReadOnlyScript(scriptName: string): void {
  if (hasWriteEnvFlag()) {
    console.warn(
      `[env] ${scriptName}: --write-env ignored (this script never writes .env). Use a dedicated setup script if needed.`,
    );
  }
}

export function parseEnvLines(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

export function readEnvFile(filePath = ROOT_ENV): Map<string, string> {
  if (!fs.existsSync(filePath)) {
    return new Map();
  }
  return parseEnvLines(fs.readFileSync(filePath, 'utf8'));
}

export function formatEnvLines(entries: Map<string, string>): string {
  return [...entries.entries()]
    .map(([key, value]) => {
      const needsQuotes = /[\s#"'=]/.test(value);
      return needsQuotes ? `${key}="${value.replace(/"/g, '\\"')}"` : `${key}=${value}`;
    })
    .join('\n');
}

/**
 * Write non-secret patches to .env.local.generated (safe default — never touches .env).
 */
export function writeEnvLocalGenerated(patches: Record<string, string>): string {
  const existing = readEnvFile(GENERATED_ENV);
  for (const [key, value] of Object.entries(patches)) {
    if ((PROTECTED_ENV_KEYS as readonly string[]).includes(key)) {
      continue;
    }
    existing.set(key, value);
  }
  const body = `# Auto-generated non-secret env patch — merge into .env manually if needed.\n# Do NOT commit secrets here.\n${formatEnvLines(existing)}\n`;
  fs.writeFileSync(GENERATED_ENV, body, 'utf8');
  return GENERATED_ENV;
}

/**
 * Merge patches into .env — only when --write-env is passed.
 * Always preserves existing SMTP_PASS, SESSION_SECRET, SMTP_USER values.
 */
export function writeEnvWithGuard(patches: Record<string, string>, filePath = ROOT_ENV): void {
  assertEnvWriteAllowed();
  const existing = readEnvFile(filePath);
  for (const key of PROTECTED_ENV_KEYS) {
    const current = existing.get(key);
    if (current?.trim()) {
      delete patches[key];
    }
  }
  for (const [key, value] of Object.entries(patches)) {
    existing.set(key, value);
  }
  const lines: string[] = ['# SXMCARDS local environment — secrets stay here only'];
  for (const [key, value] of existing.entries()) {
    const needsQuotes = /[\s#"'=]/.test(value);
    lines.push(needsQuotes ? `${key}="${value.replace(/"/g, '\\"')}"` : `${key}=${value}`);
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

export function checkMissingEnvKeys(): string[] {
  const fromFile = readEnvFile();
  const missing: string[] = [];
  for (const key of RECOMMENDED_ENV_KEYS) {
    const value = process.env[key]?.trim() || fromFile.get(key)?.trim();
    if (!value) {
      missing.push(key);
    }
  }
  return missing;
}

export function printEnvSetupInstructions(missingKeys: string[]): void {
  if (missingKeys.length === 0) return;
  console.log('\n--- Missing env keys (add to .env manually — scripts will NOT auto-write) ---');
  for (const key of missingKeys) {
    console.log(`  • ${key}`);
  }
  console.log('\nCopy template:  cp .env.example .env');
  console.log('Then edit .env locally. Never commit .env or put secrets in .env.example.');
  console.log('Optional patch file: scripts may write .env.local.generated (non-secrets only).\n');
}
