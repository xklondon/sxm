/**
 * `npm run host` — turn this device (laptop, or Android via Termux) into the
 * SXM CARDS game server. Serves the built SPA + API + Socket.IO on one port
 * bound to 0.0.0.0 so phones on the same Wi-Fi / hotspot can join.
 *
 * READ-ONLY: never writes .env (see scripts/envGuard.ts).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import '../server/src/loadEnv.js';
import {
  getHostPort,
  getJoinAddress,
  getLocalHostAddress,
  renderQrTerminal,
} from '../server/src/host.js';
import { assertEnvReadOnlyScript } from './envGuard.js';

assertEnvReadOnlyScript('host');

const port = getHostPort();
const ip = getLocalHostAddress();
const joinAddress = getJoinAddress({ ip, port });

const distIndex = path.resolve(process.cwd(), 'dist', 'index.html');
if (!existsSync(distIndex)) {
  console.error('[SXM] No build found at dist/. Run `npm run build` first, then `npm run host`.');
  process.exit(1);
}

const sharedEnv: NodeJS.ProcessEnv = {
  ...process.env,
  PORT: String(port),
  API_PORT: String(port),
  VITE_PORT: String(port),
  API_HOST: '0.0.0.0',
  SXM_SERVE_STATIC: 'true',
  SXM_DETECTED_LAN_IP: ip ?? '',
  PUBLIC_ORIGIN: joinAddress,
  CORS_ORIGIN: process.env.CORS_ORIGIN?.trim() || joinAddress,
};

async function printBanner(): Promise<void> {
  const status = await fetchStatus();
  const players = status?.players ?? 0;
  const qr = await renderQrTerminal(joinAddress).catch(() => '');

  console.log('');
  console.log('SXM CARDS SERVER');
  console.log('');
  console.log('Running');
  console.log(`Address: ${joinAddress}`);
  console.log('');
  console.log(`Players: ${players}`);
  if (qr) {
    console.log('');
    console.log('QR:');
    console.log(qr);
  }
  if (!ip) {
    console.log('[SXM] No LAN IP detected — only reachable on this device until you join a network.');
  }
}

async function fetchStatus(): Promise<{ players: number } | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/host/status`);
    if (!res.ok) return null;
    return (await res.json()) as { players: number };
  } catch {
    return null;
  }
}

async function waitForServer(maxMs = 30_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await fetchStatus()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

const children: ChildProcess[] = [];

const server = spawn('npx', ['tsx', 'server/src/index.ts'], {
  env: sharedEnv,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
children.push(server);

void (async () => {
  const ready = await waitForServer();
  if (!ready) {
    console.error(`[SXM] Server did not become ready on port ${port}. Is it already in use?`);
    return;
  }
  await printBanner();
})();

function shutdown() {
  for (const child of children) {
    child.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
