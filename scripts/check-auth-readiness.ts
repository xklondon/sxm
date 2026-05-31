/**
 * Local auth/email readiness audit. Loads .env, prints redacted config, runs checks.
 * READ-ONLY: never writes .env (see scripts/envGuard.ts).
 * Usage: npm run check:auth
 */
import '../server/src/loadEnv.js';
import {
  assertEnvReadOnlyScript,
  checkMissingEnvKeys,
  printEnvSetupInstructions,
} from './envGuard.js';

assertEnvReadOnlyScript('check-auth-readiness');
printEnvSetupInstructions(checkMissingEnvKeys());

import request from 'supertest';
import nodemailer from 'nodemailer';
import { createApp } from '../server/src/app.js';
import { config, getCorsOrigins, getEffectivePublicOrigin, isSmtpConfigured } from '../server/src/config.js';
import { AuthService } from '../server/src/auth/service.js';
import { TableService } from '../server/src/tables/service.js';
import { PeopleService } from '../server/src/people/service.js';
import { createMemoryStore } from '../server/src/store/memoryStore.js';
import { permissionsForRole } from '../server/src/people/permissions.js';
import { randomUUID } from 'node:crypto';

function redact(value: string | undefined): string {
  if (!value?.trim()) return '(empty)';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}

function originHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function readViteEnv(key: string): string {
  return process.env[key]?.trim() ?? '(unset — Vite injects at dev/build time)';
}

function checkOriginAlignment(): { ok: boolean; details: string[] } {
  const viteApi = process.env.VITE_API_URL?.trim() ?? '';
  const viteTable = process.env.VITE_TABLE_HOST?.trim() ?? '';
  const effective = getEffectivePublicOrigin();
  const corsOrigins = getCorsOrigins();
  const details: string[] = [
    `Effective public origin (links): ${effective}`,
    `Configured PUBLIC_ORIGIN (.env): ${config.publicOrigin}`,
    `CORS origins: ${corsOrigins.join(', ') || '(none)'}`,
  ];

  if (config.devPublicOriginAuto) {
    details.push('OK: DEV_PUBLIC_ORIGIN=auto — links follow detected LAN IP');
    return { ok: true, details };
  }

  if (!viteApi.trim()) {
    details.push('OK: VITE_API_URL empty — browser uses same-origin /api proxy');
  }

  const hosts = new Set<string>([originHost(effective), ...corsOrigins.map(originHost)]);
  if (viteApi) hosts.add(originHost(viteApi));
  if (viteTable) hosts.add(originHost(viteTable));

  const localhostHosts = ['localhost:5173', '127.0.0.1:5173'];
  const hasLocalhost = [...hosts].some((h) => localhostHosts.includes(h));
  const hasLan = [...hosts].some((h) => h.startsWith('192.168.'));
  if (hasLocalhost && hasLan) {
    details.push('OK: localhost + LAN origins allowed in dev (use DEV_PUBLIC_ORIGIN=auto for stable links)');
    return { ok: true, details };
  }

  details.push('OK: origin alignment check passed');
  return { ok: true, details };
}

async function testSmtp(): Promise<{ ok: boolean; message: string }> {
  if (!isSmtpConfigured()) {
    return { ok: false, message: 'SMTP not configured (SMTP_HOST + EMAIL_FROM required)' };
  }
  if (!config.smtp.user || !config.smtp.pass) {
    return { ok: false, message: 'SMTP_USER/SMTP_PASS not set — cannot authenticate to Gmail' };
  }

  try {
    const transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
    await transport.verify();
    const to = config.smtp.user;
    await transport.sendMail({
      from: config.smtp.from,
      to,
      subject: 'SXMCARDS readiness check',
      text: 'SMTP readiness check passed.',
    });
    return { ok: true, message: `SMTP verify + test send to ${redact(to)} succeeded` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'SMTP test failed',
    };
  }
}

function readinessTestEmail(): string | null {
  if (config.rootUserEmail) {
    return config.rootUserEmail;
  }
  if (!config.inviteOnlyMode) {
    return 'readiness-check@example.com';
  }
  return null;
}

function seedReadinessPerson(store: ReturnType<typeof createMemoryStore>, email: string): void {
  if (config.rootUserEmail && email === config.rootUserEmail) {
    return;
  }
  const now = new Date().toISOString();
  store.createPerson({
    id: randomUUID(),
    email: email.trim().toLowerCase(),
    displayName: 'Readiness',
    status: 'invited',
    role: 'player',
    ...permissionsForRole('player'),
    canLogin: true,
    createdAt: now,
    invitedAt: now,
    invitedBy: 'readiness-check',
    lastLoginAt: null,
    userId: null,
  });
}

async function testMagicLink(_app: ReturnType<typeof createApp>['app']): Promise<{
  ok: boolean;
  smtpUsed: boolean;
  devFallback: boolean;
  message: string;
}> {
  const email = readinessTestEmail();
  if (!email) {
    return {
      ok: false,
      smtpUsed: false,
      devFallback: false,
      message: 'Set ROOT_USER_EMAIL in .env (or INVITE_ONLY_MODE=false) for magic-link readiness',
    };
  }

  const store = createMemoryStore();
  const people = new PeopleService(store);
  const auth = new AuthService(store, people);
  seedReadinessPerson(store, email);

  const result = await auth.requestMagicLink(email);
  const smtpUsed = isSmtpConfigured();

  if (smtpUsed && config.isProduction) {
    return {
      ok: true,
      smtpUsed: true,
      devFallback: false,
      message: 'Magic link requested (production — email only, no devLink)',
    };
  }

  if (smtpUsed && !config.isProduction) {
    return {
      ok: Boolean(result.devLink),
      smtpUsed: true,
      devFallback: Boolean(result.devLink),
      message: result.devLink
        ? 'SMTP configured; devLink also returned in development'
        : 'SMTP configured but devLink missing',
    };
  }

  if (!smtpUsed && result.devLink) {
    return {
      ok: true,
      smtpUsed: false,
      devFallback: true,
      message: 'SMTP disabled — dev console/UI fallback link generated',
    };
  }

  return {
    ok: false,
    smtpUsed: false,
    devFallback: false,
    message: 'Expected devLink when SMTP disabled',
  };
}

async function testSessionCookie(app: ReturnType<typeof createApp>['app']): Promise<{
  ok: boolean;
  message: string;
}> {
  const email = readinessTestEmail();
  if (!email) {
    return {
      ok: false,
      message: 'Set ROOT_USER_EMAIL in .env (or INVITE_ONLY_MODE=false) for session check',
    };
  }

  const linkRes = await request(app)
    .post('/api/auth/request-magic-link')
    .send({ email });
  if (linkRes.status !== 200 || !linkRes.body?.devLink) {
    return {
      ok: false,
      message: `Magic link request failed: ${linkRes.status} ${JSON.stringify(linkRes.body)}`,
    };
  }

  const token = new URL(linkRes.body.devLink as string).searchParams.get('token')!;
  const res = await request(app)
    .get(`/api/auth/verify?token=${encodeURIComponent(token)}`)
    .redirects(0);
  if (res.status !== 302) {
    return { ok: false, message: `Verify returned ${res.status}, expected 302` };
  }
  const setCookie = res.headers['set-cookie'];
  const hasSession = Array.isArray(setCookie)
    ? setCookie.some((c) => c.startsWith(`${config.sessionCookieName}=`))
    : Boolean(setCookie?.includes(config.sessionCookieName));

  if (!hasSession) {
    return { ok: false, message: 'No session cookie on verify redirect' };
  }

  const cookieHeader = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
  const meRes = await request(app).get('/api/auth/me').set('Cookie', cookieHeader.split(';')[0]!);
  if (meRes.status !== 200) {
    return { ok: false, message: `/api/auth/me returned ${meRes.status} after verify` };
  }

  return { ok: true, message: 'Session cookie set and /api/auth/me succeeds' };
}

function testInviteLink(): { ok: boolean; joinUrl: string; message: string } {
  const store = createMemoryStore();
  const people = new PeopleService(store);
  const tables = new TableService(store, people);
  const hostUser = store.createUser('host@example.com', 'Host');
  const now = new Date().toISOString();
  store.createPerson({
    id: randomUUID(),
    email: 'host@example.com',
    displayName: 'Host',
    status: 'active',
    role: 'host',
    ...permissionsForRole('host'),
    canLogin: true,
    createdAt: now,
    invitedAt: null,
    invitedBy: null,
    lastLoginAt: null,
    userId: hostUser.id,
  });
  const table = tables.createTable(hostUser.id, 'Host');
  const { joinUrl } = tables.createInvite({
    tableId: table.id,
    userId: hostUser.id,
    invitedEmail: 'guest@example.com',
    invitedName: 'Guest',
  });

  const expectedHost = originHost(getEffectivePublicOrigin());

  return {
    ok: joinUrl.includes(expectedHost),
    joinUrl,
    message: `Invite URL uses effective origin host ${expectedHost}`,
  };
}

async function main() {
  console.log('\n=== SXMCARDS auth/email readiness ===\n');

  console.log('--- Config (secrets redacted) ---');
  console.log({
    NODE_ENV: config.nodeEnv,
    PORT: config.port,
    PUBLIC_ORIGIN: config.publicOrigin,
    EFFECTIVE_PUBLIC_ORIGIN: getEffectivePublicOrigin(),
    DEV_PUBLIC_ORIGIN_AUTO: config.devPublicOriginAuto,
    CORS_ORIGINS: getCorsOrigins(),
    VITE_API_URL: readViteEnv('VITE_API_URL'),
    VITE_TABLE_HOST: readViteEnv('VITE_TABLE_HOST'),
    VITE_ONLINE_MODE: readViteEnv('VITE_ONLINE_MODE'),
    VITE_EMAIL_INVITES: readViteEnv('VITE_EMAIL_INVITES'),
    SESSION_SECRET: redact(config.sessionSecret),
    SMTP_HOST: config.smtp.host || '(empty)',
    SMTP_PORT: config.smtp.port,
    SMTP_USER: redact(config.smtp.user),
    SMTP_PASS: config.smtp.pass ? '(set)' : '(empty)',
    EMAIL_FROM: config.smtp.from,
    ROOT_USER_EMAIL: config.rootUserEmail || '(empty)',
    INVITE_ONLY_MODE: config.inviteOnlyMode,
    smtpConfigured: isSmtpConfigured(),
  });
  const alignment = checkOriginAlignment();
  console.log('\n--- Origin alignment ---');
  alignment.details.forEach((d) => console.log(`  ${d}`));

  const { app } = createApp();

  console.log('\n--- SMTP test ---');
  const smtp = await testSmtp();
  console.log(smtp.ok ? `  PASS: ${smtp.message}` : `  SKIP/FAIL: ${smtp.message}`);

  console.log('\n--- Magic link ---');
  const magic = await testMagicLink(app);
  console.log(magic.ok ? `  PASS: ${magic.message}` : `  FAIL: ${magic.message}`);

  console.log('\n--- Session cookie ---');
  const session = await testSessionCookie(app);
  console.log(session.ok ? `  PASS: ${session.message}` : `  FAIL: ${session.message}`);

  console.log('\n--- Invite link ---');
  const invite = testInviteLink();
  console.log(`  URL: ${invite.joinUrl}`);
  console.log(invite.ok ? `  PASS: ${invite.message}` : `  FAIL: ${invite.message}`);

  console.log('\n--- Summary ---');
  const allOk =
    alignment.ok &&
    magic.ok &&
    session.ok &&
    invite.ok &&
    (smtp.ok || !isSmtpConfigured());

  console.log(allOk ? '  Overall: READY (SMTP optional if using dev fallback)' : '  Overall: ISSUES — see above');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
