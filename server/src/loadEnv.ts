import { loadEnvFile } from 'node:process';
import path from 'node:path';

/** Project-root `.env` (npm scripts run with cwd = repo root). */
const rootEnv = path.resolve(process.cwd(), '.env');

export function loadProjectEnv(): void {
  try {
    loadEnvFile(rootEnv);
  } catch {
    // .env is optional; process env / platform vars may already be set
  }
}

loadProjectEnv();