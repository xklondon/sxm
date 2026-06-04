import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer/index.js';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import {
  config,
  getEmailFrom,
  getEmailProvider,
  getFromDomain,
  isEmailConfigured,
  isResendConfigured,
  isResendSandboxFromAddress,
  isSmtpConfigured,
  parseFromEmailAddress,
} from '../config.js';
import { getCorsOrigins, getEffectivePublicOrigin } from '../config.js';
import { sendResendMail } from './resend.js';

export const SMTP_HARD_TIMEOUT_MS = 20_000;

const SMTP_SOCKET_TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
  dnsTimeout: 10_000,
} as const;

export type SmtpStage = 'createTransport' | 'verify' | 'sendMail';

export class SmtpOperationTimeoutError extends Error {
  readonly stage: SmtpStage;
  readonly host: string;
  readonly port: number;
  readonly code = 'ETIMEDOUT';

  constructor(stage: SmtpStage, host: string, port: number) {
    super(`SMTP operation timed out (${stage})`);
    this.name = 'SmtpOperationTimeoutError';
    this.stage = stage;
    this.host = host;
    this.port = port;
  }
}

function env(key: string): string {
  return process.env[key]?.trim() ?? '';
}

function envBool(key: string, fallback = false): boolean {
  const v = process.env[key]?.trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return fallback;
}

export { sanitizeEmail } from './sanitize.js';
import { sanitizeEmail } from './sanitize.js';

export function getSmtpSecureFlag(port = config.smtp.port): boolean {
  const raw = process.env.SMTP_SECURE?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return port === 465;
}

/** True when env explicitly configures Gmail-style SSL on port 465. */
export function is465SslFallbackMode(): boolean {
  const port = Number(process.env.SMTP_PORT?.trim() || config.smtp.port);
  return port === 465 && getSmtpSecureFlag(465);
}

export function getSmtpTransportOptions(overrides?: {
  port?: number;
  secure?: boolean;
}): SMTPTransport.Options {
  const port = overrides?.port ?? config.smtp.port;
  const secure = overrides?.secure ?? getSmtpSecureFlag(port);
  return {
    host: config.smtp.host,
    port,
    secure,
    auth: config.smtp.user
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined,
    ...SMTP_SOCKET_TIMEOUTS,
  };
}

export function get465SslTransportOptions(): SMTPTransport.Options | null {
  if (!is465SslFallbackMode()) {
    return null;
  }
  return getSmtpTransportOptions({ port: 465, secure: true });
}

export function getEmailConfigSnapshot() {
  const provider = getEmailProvider();
  const fromEmail = getEmailFrom();
  const fromAddress = parseFromEmailAddress(fromEmail);
  const fromDomain = getFromDomain(fromEmail);
  const resendSandboxMode =
    isResendConfigured() && isResendSandboxFromAddress(config.resend.from);
  const explicitProvider = env('EMAIL_PROVIDER', 'auto').toLowerCase();
  const snap = {
    env: config.nodeEnv,
    publicOrigin: getEffectivePublicOrigin(),
    corsOrigin: env('CORS_ORIGIN') || config.publicOrigin,
    corsOrigins: getCorsOrigins(),
    emailProvider: provider,
    emailProviderEnv: explicitProvider || 'auto',
    effectiveProvider: provider,
    emailConfigured: isEmailConfigured(),
    fromEmail,
    fromAddress,
    fromDomain,
    resendConfigured: isResendConfigured(),
    resendFrom: config.resend.from || '',
    resendSandboxMode,
    resendDomainVerifiedHint: resendSandboxMode
      ? 'Resend sandbox FROM — verify a domain at resend.com/domains or set EMAIL_PROVIDER=smtp with SMTP_* vars'
      : provider === 'resend'
        ? 'Ensure FROM domain is verified in the Resend dashboard'
        : null,
    resendApiKeyPresent: Boolean(config.resend.apiKey),
    smtpHost: config.smtp.host || '',
    smtpPort: config.smtp.port,
    smtpSecure: getSmtpSecureFlag(),
    smtpUserPresent: Boolean(config.smtp.user),
    smtpPassPresent: Boolean(config.smtp.pass),
    smtpConfigured: isSmtpConfigured(),
    ssl465FallbackAvailable: is465SslFallbackMode(),
  };
  return snap;
}

/** Alias for /api/debug/email-provider — same sanitized snapshot. */
export function getEmailProviderDiagnostics() {
  return getEmailConfigSnapshot();
}

export function formatSmtpError(err: unknown): Record<string, unknown> {
  if (err instanceof SmtpOperationTimeoutError) {
    return {
      name: err.name,
      message: err.message,
      code: err.code,
      stage: err.stage,
      host: err.host,
      port: err.port,
    };
  }
  if (!(err instanceof Error)) {
    return { message: String(err) };
  }
  const smtpErr = err as Error & {
    code?: string;
    command?: string;
    responseCode?: number;
    response?: string;
  };
  return {
    name: smtpErr.name,
    message: smtpErr.message,
    code: smtpErr.code,
    command: smtpErr.command,
    responseCode: smtpErr.responseCode,
    response: smtpErr.response,
    stack: smtpErr.stack,
  };
}

export function smtpErrorCode(err: unknown): string | undefined {
  if (err instanceof SmtpOperationTimeoutError) {
    return err.code;
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export function smtpFailureResponse(
  err: unknown,
  stage: SmtpStage,
): { ok: false; stage: SmtpStage; code?: string; message: string } {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'SMTP failed';
  return {
    ok: false,
    stage: err instanceof SmtpOperationTimeoutError ? err.stage : stage,
    code: smtpErrorCode(err),
    message,
  };
}

export function isSmtpTimeoutError(err: unknown): boolean {
  return err instanceof SmtpOperationTimeoutError;
}

export function shouldExposeEmailErrorDetail(): boolean {
  return !config.isProduction || envBool('DEBUG_EMAIL_VERBOSE');
}

export function clientEmailErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Email send failed';
  if (/only send testing emails to your own email address/i.test(raw)) {
    return (
      'Email provider is in Resend sandbox mode and cannot send to external addresses. ' +
      'Verify a domain at resend.com/domains and set RESEND_FROM to that domain, ' +
      'or set EMAIL_PROVIDER=smtp with SMTP_HOST/SMTP_USER/SMTP_PASS/EMAIL_FROM configured.'
    );
  }
  if (/verify a domain at resend\.com\/domains/i.test(raw)) {
    return raw;
  }
  return raw;
}

export function logSmtpContext(label: string): void {
  const snap = getEmailConfigSnapshot();
  // eslint-disable-next-line no-console
  console.log(
    `[SXM][email] ${label} provider=${snap.emailProvider} publicOrigin=${snap.publicOrigin} corsOrigin=${snap.corsOrigin} smtpHost=${snap.smtpHost} smtpPort=${snap.smtpPort} smtpSecure=${snap.smtpSecure} smtpUserPresent=${snap.smtpUserPresent} smtpPassPresent=${snap.smtpPassPresent} resendConfigured=${snap.resendConfigured} from=${snap.fromEmail || '(empty)'} configured=${snap.emailConfigured}`,
  );
}

function logTimeout(stage: SmtpStage, host: string, port: number): void {
  // eslint-disable-next-line no-console
  console.error(
    `[SXM][email] SMTP operation timed out stage=${stage} host=${host} port=${port}`,
  );
}

export async function withSmtpHardTimeout<T>(
  stage: SmtpStage,
  host: string,
  port: number,
  operation: () => Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      logTimeout(stage, host, port);
      reject(new SmtpOperationTimeoutError(stage, host, port));
    }, SMTP_HARD_TIMEOUT_MS);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function createSmtpTransport(
  context: string,
  transportOpts: SMTPTransport.Options,
): nodemailer.Transporter<SMTPTransport.SentMessageInfo> {
  const host = transportOpts.host ?? config.smtp.host;
  const port = transportOpts.port ?? config.smtp.port;
  const secure = transportOpts.secure ?? false;
  // eslint-disable-next-line no-console
  console.log(
    `[SXM][email] ${context} createTransport before host=${host} port=${port} secure=${secure}`,
  );
  const transport = nodemailer.createTransport(transportOpts);
  // eslint-disable-next-line no-console
  console.log(`[SXM][email] ${context} createTransport after host=${host} port=${port}`);
  return transport;
}

async function verifyTransport(
  context: string,
  transport: nodemailer.Transporter<SMTPTransport.SentMessageInfo>,
  host: string,
  port: number,
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[SXM][email] ${context} transporter.verify() before host=${host} port=${port}`);
  await withSmtpHardTimeout('verify', host, port, () => transport.verify());
  // eslint-disable-next-line no-console
  console.log(`[SXM][email] ${context} transporter.verify() after host=${host} port=${port}`);
}

async function sendMailOnTransport(
  context: string,
  transport: nodemailer.Transporter<SMTPTransport.SentMessageInfo>,
  host: string,
  port: number,
  mail: Mail.Options,
): Promise<SMTPTransport.SentMessageInfo> {
  // eslint-disable-next-line no-console
  console.log(`[SXM][email] ${context} transporter.sendMail() before host=${host} port=${port}`);
  const info = await withSmtpHardTimeout('sendMail', host, port, () => transport.sendMail(mail));
  // eslint-disable-next-line no-console
  console.log(`[SXM][email] ${context} transporter.sendMail() after host=${host} port=${port}`);
  return info;
}

export async function sendMailWithLogging(
  context: string,
  mail: Mail.Options,
): Promise<SMTPTransport.SentMessageInfo> {
  if (!isEmailConfigured()) {
    const msg =
      getEmailProvider() === 'resend' ? 'Resend not configured' : 'SMTP not configured';
    // eslint-disable-next-line no-console
    console.error(`[SXM][email] ${context} aborted: ${msg}`);
    throw new Error(msg);
  }

  if (getEmailProvider() === 'resend') {
    logSmtpContext(`${context} before resend send`);
    try {
      return await sendResendMail(context, mail);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[SXM][email] ${context} resend send failed`, formatSmtpError(err));
      throw err;
    }
  }

  const to = typeof mail.to === 'string' ? mail.to : Array.isArray(mail.to) ? mail.to[0] : '';
  const recipient = typeof to === 'string' ? sanitizeEmail(to) : '(unknown)';
  const transportOpts = getSmtpTransportOptions();
  const host = transportOpts.host ?? config.smtp.host;
  const port = transportOpts.port ?? config.smtp.port;

  logSmtpContext(`${context} before sendMail recipient=${recipient}`);
  // eslint-disable-next-line no-console
  console.log(`[SXM][email] ${context} subject=${mail.subject ?? '(none)'}`);

  const transport = createSmtpTransport(context, transportOpts);

  try {
    const info = await sendMailOnTransport(context, transport, host, port, mail);
    // eslint-disable-next-line no-console
    console.log(
      `[SXM][email] ${context} sendMail ok messageId=${info.messageId ?? '(none)'} accepted=${JSON.stringify(info.accepted ?? [])} rejected=${JSON.stringify(info.rejected ?? [])}`,
    );
    return info;
  } catch (err) {
    const detail = formatSmtpError(err);
    // eslint-disable-next-line no-console
    console.error(`[SXM][email] ${context} sendMail failed`, detail);
    throw err;
  } finally {
    transport.close();
  }
}

export type DebugTestEmailOptions = {
  /** Use port 465 + secure when env SMTP_PORT=465 and SMTP_SECURE=true. */
  use465?: boolean;
  /** After primary failure, retry 465/ssl when fallback mode is available. */
  fallback465?: boolean;
};

export async function sendDebugTestEmail(
  mail: Mail.Options,
  options: DebugTestEmailOptions = {},
): Promise<SMTPTransport.SentMessageInfo> {
  const context = 'debug/send-test-email';
  if (!isEmailConfigured()) {
    throw new Error(
      getEmailProvider() === 'resend' ? 'Resend not configured' : 'SMTP not configured',
    );
  }

  if (getEmailProvider() === 'resend') {
    return sendMailWithLogging(context, mail);
  }

  const profiles: { label: string; opts: SMTPTransport.Options }[] = [];
  const primary = getSmtpTransportOptions();
  profiles.push({ label: 'primary', opts: primary });

  const ssl465 = get465SslTransportOptions();
  if (options.use465 && ssl465) {
    profiles.length = 0;
    profiles.push({ label: '465-ssl', opts: ssl465 });
  } else if (
    options.fallback465 &&
    ssl465 &&
    (primary.port ?? config.smtp.port) !== 465
  ) {
    profiles.push({ label: '465-ssl-fallback', opts: ssl465 });
  }

  let lastErr: unknown;
  for (const profile of profiles) {
    const host = profile.opts.host ?? config.smtp.host;
    const port = profile.opts.port ?? config.smtp.port;
    // eslint-disable-next-line no-console
    console.log(
      `[SXM][email] ${context} profile=${profile.label} host=${host} port=${port} secure=${profile.opts.secure ?? false}`,
    );

    const transport = createSmtpTransport(`${context}/${profile.label}`, profile.opts);
    try {
      await verifyTransport(`${context}/${profile.label}`, transport, host, port);
      const info = await sendMailOnTransport(
        `${context}/${profile.label}`,
        transport,
        host,
        port,
        mail,
      );
      // eslint-disable-next-line no-console
      console.log(
        `[SXM][email] ${context} sendMail ok profile=${profile.label} messageId=${info.messageId ?? '(none)'} accepted=${JSON.stringify(info.accepted ?? [])} rejected=${JSON.stringify(info.rejected ?? [])}`,
      );
      return info;
    } catch (err) {
      lastErr = err;
      const detail = formatSmtpError(err);
      // eslint-disable-next-line no-console
      console.error(`[SXM][email] ${context} profile=${profile.label} failed`, detail);
      if (profile.label !== profiles[profiles.length - 1]!.label) {
        // eslint-disable-next-line no-console
        console.log(`[SXM][email] ${context} trying next SMTP profile`);
        continue;
      }
      throw err;
    } finally {
      transport.close();
    }
  }

  throw lastErr ?? new Error('SMTP debug send failed');
}
