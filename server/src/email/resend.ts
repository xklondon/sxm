import type Mail from 'nodemailer/lib/mailer/index.js';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import { config } from '../config.js';
import { sanitizeEmail } from './sanitize.js';

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 20_000;

function resolveRecipient(mail: Mail.Options): string {
  const to = mail.to;
  if (typeof to === 'string') {
    return to;
  }
  if (Array.isArray(to) && typeof to[0] === 'string') {
    return to[0];
  }
  return '';
}

function resolveFrom(mail: Mail.Options): string {
  if (typeof mail.from === 'string' && mail.from.trim()) {
    return mail.from;
  }
  return config.resend.from;
}

export async function sendResendMail(
  context: string,
  mail: Mail.Options,
): Promise<SMTPTransport.SentMessageInfo> {
  const to = resolveRecipient(mail);
  const from = resolveFrom(mail);
  const recipient = sanitizeEmail(to);

  // eslint-disable-next-line no-console
  console.log(
    `[SXM][email] ${context} resend API before recipient=${recipient} from=${from} subject=${mail.subject ?? '(none)'}`,
  );

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resend.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: mail.subject ?? '',
      html: typeof mail.html === 'string' ? mail.html : undefined,
      text: typeof mail.text === 'string' ? mail.text : undefined,
    }),
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
  });

  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    name?: string;
  };

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error(`[SXM][email] ${context} resend API failed status=${res.status}`, {
      name: body.name,
      message: body.message,
    });
    throw new Error(body.message || `Resend API error (${res.status})`);
  }

  // eslint-disable-next-line no-console
  console.log(
    `[SXM][email] ${context} resend API ok messageId=${body.id ?? '(none)'} accepted=${JSON.stringify([to])}`,
  );

  return {
    messageId: body.id,
    accepted: [to],
    rejected: [],
  } as SMTPTransport.SentMessageInfo;
}
