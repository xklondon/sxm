/**
 * Live API flow test against running dev server (read-only — no .env writes).
 * Usage: npm run test:live  (requires npm run dev in another terminal)
 */
import '../server/src/loadEnv.js';
import { assertEnvReadOnlyScript } from './envGuard.js';

assertEnvReadOnlyScript('test-live-flow');

const base =
  process.env.SXM_TEST_BASE_URL?.trim() ||
  process.env.PUBLIC_ORIGIN?.trim() ||
  'http://127.0.0.1:5173';
const smtpUser = process.env.SMTP_USER?.trim();

async function fetchJson(path: string, init: RequestInit = {}) {
  const res = await fetch(`${base}${path}`, {
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

async function main() {
  console.log('\n=== SXMCARDS live flow test ===');
  console.log(`Target: ${base}\n`);

  const health = await fetchJson('/health');
  if (health.res.status !== 200) {
    console.error('FAIL: /health — is `npm run dev` running?');
    process.exit(1);
  }
  console.log('PASS: /health');

  const email = smtpUser || 'live-test@example.com';
  const linkRes = await fetchJson('/api/auth/request-magic-link', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  if (linkRes.res.status !== 200) {
    console.error('FAIL: magic link request', linkRes.body);
    process.exit(1);
  }
  const devLink = (linkRes.body as { devLink?: string }).devLink;
  const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  console.log(
    smtpConfigured
      ? `PASS: magic link requested (email sent to ${email} if SMTP works)`
      : `PASS: magic link requested (dev fallback)`,
  );
  if (!devLink && !smtpConfigured) {
    console.error('FAIL: no devLink and SMTP not configured');
    process.exit(1);
  }

  const verifyUrl = devLink ?? '';
  const token = verifyUrl ? new URL(verifyUrl).searchParams.get('token') : null;
  if (!token) {
    console.log('SKIP: verify step (check email for link when SMTP configured)');
    process.exit(0);
  }

  if (verifyUrl.includes('localhost') || verifyUrl.includes('127.0.0.1')) {
    console.error('FAIL: magic link contains localhost:', verifyUrl);
    process.exit(1);
  }
  console.log('PASS: magic link uses LAN origin');

  const verifyPath = `/api/auth/verify?token=${encodeURIComponent(token)}`;
  const verifyRes = await fetchJson(verifyPath);
  if (verifyRes.res.status !== 302) {
    console.error('FAIL: verify status', verifyRes.res.status);
    process.exit(1);
  }
  const cookie = cookieFromResponse(verifyRes.res);
  if (!cookie) {
    console.error('FAIL: no session cookie on verify');
    process.exit(1);
  }
  console.log('PASS: session cookie on verify');

  const meRes = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
  if (meRes.status !== 200) {
    console.error('FAIL: /api/auth/me', meRes.status);
    process.exit(1);
  }
  const me = (await meRes.json()) as { user: { email: string } };
  console.log(`PASS: /api/auth/me → ${me.user.email}`);

  const tableRes = await fetch(`${base}/api/tables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ displayName: 'Host' }),
  });
  if (tableRes.status !== 201) {
    console.error('FAIL: create table', await tableRes.text());
    process.exit(1);
  }
  const table = (await tableRes.json()) as { tableId: string };
  console.log(`PASS: create table ${table.tableId}`);

  const inviteRes = await fetch(`${base}/api/tables/${table.tableId}/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ email: 'guest@example.com', name: 'Guest' }),
  });
  if (inviteRes.status !== 201) {
    console.error('FAIL: create invite', await inviteRes.text());
    process.exit(1);
  }
  const invite = (await inviteRes.json()) as { joinUrl: string };
  if (invite.joinUrl.includes('localhost') || invite.joinUrl.includes('127.0.0.1')) {
    console.error('FAIL: invite has localhost:', invite.joinUrl);
    process.exit(1);
  }
  console.log(`PASS: invite link ${invite.joinUrl}`);

  console.log('\nOverall: LIVE FLOW OK\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
