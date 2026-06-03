import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer/index.js';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import { config, isSmtpConfigured } from '../config.js';
import { getCorsOrigins, getEffectivePublicOrigin } from '../config.js';

function env(key: string): string {
  return process.env[key]?.trim() ?? '';
}

function envBool(key: string, fallback = false): boolean {
  const v = process.env[key]?.trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return fallback;
}

/** Sanitized recipient for logs (never full address in production logs). */
export function sanitizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf('@');
  if (at < 1) {
    return '(invalid)';
  }
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  return `${local[0]}***@${domain}`;
}

export function getSmtpSecureFlag(): boolean {
  const raw = process.env.SMTP_SECURE?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return config.smtp.port === 465;
}

export function getSmtpTransportOptions(): SMTPTransport.Options {
  return {
    host: config.smtp.host,
    port: config.smtp.port,
    secure: getSmtpSecureFlag(),
    auth: config.smtp.user
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined,
  };
}

export function getEmailConfigSnapshot() {
  return {
    env: config.nodeEnv,
    publicOrigin: getEffectivePublicOrigin(),
    corsOrigin: env('CORS_ORIGIN') || config.publicOrigin,
    corsOrigins: getCorsOrigins(),
    smtpHost: config.smtp.host || '',
    smtpPort: config.smtp.port,
    smtpSecure: getSmtpSecureFlag(),
    smtpUserPresent: Boolean(config.smtp.user),
    smtpPassPresent: Boolean(config.smtp.pass),
    fromEmail: config.smtp.from || '',
    smtpConfigured: isSmtpConfigured(),
  };
}

export function formatSmtpError(err: unknown): Record<string, unknown> {
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

export function shouldExposeEmailErrorDetail(): boolean {
  return !config.isProduction || envBool('DEBUG_EMAIL_VERBOSE');
}

export function clientEmailErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return 'Email send failed';
}

export function logSmtpContext(label: string): void {
  const snap = getEmailConfigSnapshot();
  // eslint-disable-next-line no-console
  console.log(
    `[SXM][email] ${label} publicOrigin=${snap.publicOrigin} corsOrigin=${snap.corsOrigin} smtpHost=${snap.smtpHost} smtpPort=${snap.smtpPort} smtpSecure=${snap.smtpSecure} smtpUserPresent=${snap.smtpUserPresent} smtpPassPresent=${snap.smtpPassPresent} from=${snap.fromEmail || '(empty)'} configured=${snap.smtpConfigured}`,
  );
}

export async function sendMailWithLogging(
  context: string,
  mail: Mail.Options,
): Promise<SMTPTransport.SentMessageInfo> {
  if (!isSmtpConfigured()) {
    const msg = 'SMTP not configured';
    // eslint-disable-next-line no-console
    console.error(`[SXM][email] ${context} aborted: ${msg}`);
    throw new Error(msg);
  }

  const to = typeof mail.to === 'string' ? mail.to : Array.isArray(mail.to) ? mail.to[0] : '';
  const recipient = typeof to === 'string' ? sanitizeEmail(to) : '(unknown)';
  const transportOpts = getSmtpTransportOptions();

  logSmtpContext(`${context} before sendMail recipient=${recipient}`);
  // eslint-disable-next-line no-console
  console.log(`[SXM][email] ${context} subject=${mail.subject ?? '(none)'}`);

  const transport = nodemailer.createTransport(transportOpts);

  try {
    const info = await transport.sendMail(mail);
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
  }
}
