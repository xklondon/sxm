import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

export interface SessionPayload {
  userId: string;
  email: string;
  /** When false, cookie is a browser session cookie (no Max-Age). Omitted = persistent. */
  persistent?: boolean;
}

function sign(data: string): string {
  return createHmac('sha256', config.sessionSecret).update(data).digest('base64url');
}

export function createSessionToken(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = sign(body!);
  try {
    if (!timingSafeEqual(Buffer.from(sig!), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body!, 'base64url').toString('utf8')) as SessionPayload;
  } catch {
    return null;
  }
}

export function createMagicLinkToken(): string {
  return randomBytes(32).toString('base64url');
}

export function createInviteToken(): string {
  return randomBytes(24).toString('base64url');
}
