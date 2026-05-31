/**
 * Local origin + auth/table flow test against running dev server.
 * Usage: npm run dev (terminal 1) → npm run test:local-flow (terminal 2)
 */
import '../server/src/loadEnv.js';
import { assertEnvReadOnlyScript } from './envGuard.js';
import { linkUsesOrigin, isLocalhostOrigin } from '../server/src/origin.js';

assertEnvReadOnlyScript('test-local-flow');

const proxyBase =
  process.env.SXM_TEST_BASE_URL?.trim() ||
  `http://127.0.0.1:${process.env.VITE_PORT || 5173}`;
const rootEmail = process.env.ROOT_USER_EMAIL?.trim() || 'root@example.com';
const forbidLocalhostLinks = process.env.SXM_ALLOW_LOCALHOST_LINKS !== 'true';

async function fetchJson(path: string, init: RequestInit = {}) {
  const res = await fetch(`${proxyBase}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    redirect: 'manual',
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

function cookieFromResponse(res: Response): string | null {
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const raw = setCookie.length ? setCookie : [res.headers.get('set-cookie') ?? ''];
  for (const line of raw) {
    if (!line) continue;
    const match = line.match(/sxmcards_session=[^;]+/);
    if (match) return match[0]!;
  }
  return null;
}

function assertLinkOrigin(label: string, url: string, effectiveOrigin: string): void {
  if (forbidLocalhostLinks && isLocalhostOrigin(new URL(url).origin)) {
    throw new Error(`${label} uses localhost — set DEV_PUBLIC_ORIGIN=auto for LAN links`);
  }
  if (!linkUsesOrigin(url, effectiveOrigin)) {
    throw new Error(`${label} host mismatch: ${url} (expected origin ${effectiveOrigin})`);
  }
}

async function main() {
  console.log('\n=== SXM Casino local flow test ===');
  console.log(`Proxy base: ${proxyBase}\n`);

  const health = await fetchJson('/api/health');
  if (health.res.status !== 200) {
    console.error('FAIL: /api/health — is `npm run dev` running?');
    process.exit(1);
  }
  console.log('PASS: /api/health via Vite proxy');

  const devConfig = await fetchJson('/api/dev/config');
  if (devConfig.res.status !== 200) {
    console.error('FAIL: /api/dev/config', devConfig.body);
    process.exit(1);
  }
  const cfg = devConfig.body as {
    effectivePublicOrigin: string;
    devPublicOriginAuto?: boolean;
  };
  const effectiveOrigin = cfg.effectivePublicOrigin;
  console.log(`PASS: effective public origin → ${effectiveOrigin}${cfg.devPublicOriginAuto ? ' (auto)' : ''}`);

  const linkRes = await fetchJson('/api/auth/request-magic-link', {
    method: 'POST',
    body: JSON.stringify({ email: rootEmail }),
  });
  if (linkRes.res.status !== 200) {
    console.error('FAIL: magic link request', linkRes.body);
    process.exit(1);
  }
  const devLink = (linkRes.body as { devLink?: string }).devLink;
  if (!devLink) {
    console.error('FAIL: no devLink returned (need NODE_ENV=development)');
    process.exit(1);
  }
  assertLinkOrigin('Magic link', devLink, effectiveOrigin);
  console.log('PASS: magic link uses effective public origin');

  const token = new URL(devLink).searchParams.get('token');
  if (!token) {
    console.error('FAIL: magic link missing token');
    process.exit(1);
  }

  const verifyRes = await fetchJson(`/api/auth/verify?token=${encodeURIComponent(token)}`);
  if (verifyRes.res.status !== 302) {
    console.error('FAIL: verify status', verifyRes.res.status, verifyRes.body);
    process.exit(1);
  }
  const cookie = cookieFromResponse(verifyRes.res);
  if (!cookie) {
    console.error('FAIL: no session cookie on verify');
    process.exit(1);
  }
  console.log('PASS: verify creates session');

  const meRes = await fetch(`${proxyBase}/api/auth/me`, { headers: { Cookie: cookie } });
  if (meRes.status !== 200) {
    console.error('FAIL: /api/auth/me', meRes.status);
    process.exit(1);
  }
  const me = (await meRes.json()) as { user: { email: string; role?: string; isRoot?: boolean } };
  console.log(`PASS: /api/auth/me → ${me.user.email} (role=${me.user.role ?? 'n/a'})`);

  const tableRes = await fetch(`${proxyBase}/api/tables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ displayName: 'Root Host' }),
  });
  if (tableRes.status !== 201) {
    console.error('FAIL: create table', await tableRes.text());
    process.exit(1);
  }
  const table = (await tableRes.json()) as { tableId: string };
  console.log(`PASS: create table ${table.tableId}`);

  const inviteRes = await fetch(`${proxyBase}/api/tables/${table.tableId}/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ email: 'guest@example.com', name: 'Guest' }),
  });
  if (inviteRes.status !== 201) {
    console.error('FAIL: create invite', await inviteRes.text());
    process.exit(1);
  }
  const invite = (await inviteRes.json()) as { joinUrl: string };
  assertLinkOrigin('Invite link', invite.joinUrl, effectiveOrigin);
  if (!invite.joinUrl.includes('/api/tables/invites/accept?token=')) {
    throw new Error('Invite link must use /api/tables/invites/accept');
  }
  console.log('PASS: invite uses one-click accept link');
  console.log(`PASS: invite link uses effective public origin`);

  console.log('\nOverall: LOCAL FLOW OK\n');
  console.log('Manual game-flow checklist (two browsers):');
  console.log(`  1. Open ${effectiveOrigin}/login — root magic link login`);
  console.log('  2. People button visible for root/admin');
  console.log('  3. New online table → invite test player by email');
  console.log('  4. Incognito: login as invited player → join table link');
  console.log('  5. Assign box, place bet, deal, hit, stand — both windows sync\n');
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
