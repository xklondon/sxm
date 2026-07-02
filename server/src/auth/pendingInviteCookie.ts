import type { Request, Response } from 'express';
import { shouldSecureSessionCookie } from './cookies.js';

export const PENDING_INVITE_COOKIE_NAME = 'sxm_pending_invite_token';
export const PENDING_INVITE_MAX_AGE_SEC = 15 * 60;

export function buildPendingInviteCookieHeader(token: string, req?: Request): string {
  const secure = shouldSecureSessionCookie(req) ? '; Secure' : '';
  return `${PENDING_INVITE_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${PENDING_INVITE_MAX_AGE_SEC}${secure}`;
}

export function buildClearPendingInviteCookieHeader(): string {
  return `${PENDING_INVITE_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export function readPendingInviteToken(req: Request): string | null {
  const cookie = req.headers.cookie ?? '';
  const match = cookie.match(new RegExp(`${PENDING_INVITE_COOKIE_NAME}=([^;]+)`));
  if (!match?.[1]) {
    return null;
  }
  return decodeURIComponent(match[1]);
}

export function setPendingInviteCookie(res: Response, token: string, req?: Request): void {
  res.append('Set-Cookie', buildPendingInviteCookieHeader(token, req));
}

export function clearPendingInviteCookie(res: Response): void {
  res.append('Set-Cookie', buildClearPendingInviteCookieHeader());
}

/** Only allow same-origin relative app paths (e.g. /?table=abc). */
export function safeReturnTo(origin: string, value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const trimmed = value.trim();
  const base = origin.replace(/\/$/, '');
  try {
    const url = trimmed.startsWith('http') ? new URL(trimmed) : new URL(trimmed, `${base}/`);
    if (url.origin !== base) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function buildInviteLoginRedirect(origin: string, preview: {
  invitedEmail: string;
  tableName?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set('invitedEmail', preview.invitedEmail);
  if (preview.tableName) {
    params.set('inviteTableName', preview.tableName);
  }
  return `${origin}/login?${params.toString()}`;
}
