/**
 * Local dev orchestrator: Vite on :5173 (public LAN) + API on internal port (proxied).
 * READ-ONLY: never writes .env (see scripts/envGuard.ts).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import '../server/src/loadEnv.js';
import { findAvailablePort } from '../server/src/findPort.js';
import {
  detectLanIPv4,
  originHostMismatchWarning,
  resolveEffectivePublicOrigin,
} from '../server/src/origin.js';
import {
  assertEnvReadOnlyScript,
  checkMissingEnvKeys,
  printEnvSetupInstructions,
} from './envGuard.js';

assertEnvReadOnlyScript('dev');
printEnvSetupInstructions(checkMissingEnvKeys());

const VITE_PORT = Number(process.env.VITE_PORT || 5173);
const configuredPublicOrigin =
  process.env.PUBLIC_ORIGIN?.trim() || `http://localhost:${VITE_PORT}`;
const configuredApiPort = Number(process.env.API_PORT || 0);
const detectedLanIp = detectLanIPv4();

const { effective: effectivePublicOrigin, autoApplied } = resolveEffectivePublicOrigin({
  nodeEnv: process.env.NODE_ENV?.trim() || 'development',
  devPublicOrigin: process.env.DEV_PUBLIC_ORIGIN?.trim() || '',
  publicOrigin: configuredPublicOrigin,
  vitePort: VITE_PORT,
  detectedLanIp: detectedLanIp ?? undefined,
});

const apiPort = await findAvailablePort([
  configuredApiPort,
  3017,
  5180,
  5190,
  3018,
  3020,
]);

const sharedEnv: NodeJS.ProcessEnv = {
  ...process.env,
  PORT: String(apiPort),
  API_PORT: String(apiPort),
  SXM_API_PORT: String(apiPort),
  SXM_DETECTED_LAN_IP: detectedLanIp ?? '',
  API_HOST: '127.0.0.1',
  PUBLIC_ORIGIN: configuredPublicOrigin,
  CORS_ORIGIN: process.env.CORS_ORIGIN?.trim() || configuredPublicOrigin,
};

console.log('');
console.log(`[SXM] Local browser:  http://localhost:${VITE_PORT}`);
if (detectedLanIp) {
  console.log(`[SXM] LAN / phone:    http://${detectedLanIp}:${VITE_PORT}`);
}
console.log(`[SXM] Effective public origin: ${effectivePublicOrigin}${autoApplied ? ' (DEV_PUBLIC_ORIGIN=auto)' : ''}`);
const mismatch = originHostMismatchWarning({
  publicOrigin: configuredPublicOrigin,
  detectedLanIp,
  vitePort: VITE_PORT,
  autoApplied,
});
if (mismatch) {
  console.warn(mismatch);
}
console.log(`[SXM] API: http://127.0.0.1:${apiPort} (internal — proxied at /api on :${VITE_PORT})`);
console.log(`[SXM] Vite proxy target: http://127.0.0.1:${apiPort}`);
console.log('');

async function waitForOk(url: string, maxMs = 45_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return true;
      }
    } catch {
      // retry until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function runStartupSelfCheck(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const directUrl = `http://127.0.0.1:${apiPort}/health`;
  const proxyUrl = `http://127.0.0.1:${VITE_PORT}/api/health`;
  const directOk = await waitForOk(directUrl);
  console.log(`[SXM] Self-check API direct: ${directOk ? 'PASS' : 'FAIL'} ${directUrl}`);
  const proxyOk = directOk ? await waitForOk(proxyUrl) : false;
  console.log(`[SXM] Self-check Vite proxy: ${proxyOk ? 'PASS' : 'FAIL'} ${proxyUrl}`);
  if (!directOk || !proxyOk) {
    console.log('[SXM] Hint: use npm run dev (not dev:vite alone) so SXM_API_PORT matches the proxy.');
  }
}

const children: ChildProcess[] = [];

function run(command: string, args: string[]): ChildProcess {
  const child = spawn(command, args, {
    env: sharedEnv,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  children.push(child);
  return child;
}

run('npx', [
  'tsx',
  'watch',
  '--exclude',
  'node_modules/**',
  '--exclude',
  'dist/**',
  '--exclude',
  'coverage/**',
  '--exclude',
  'playwright-report/**',
  '--exclude',
  'test-results/**',
  '--exclude',
  'src/engine/**/*.js',
  '--exclude',
  'reference-ui/**',
  'server/src/index.ts',
]);
run('npx', ['vite', '--port', String(VITE_PORT), '--strictPort']);

void runStartupSelfCheck();

function shutdown() {
  for (const child of children) {
    child.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
