import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { verifySessionToken, createSessionToken, type SessionPayload } from './tokens.js';
import {
  buildClearSessionCookieHeader,
  buildSessionCookieHeader,
  type SessionCookieOptions,
} from './cookies.js';

export interface AuthedRequest extends Request {
  auth?: SessionPayload;
}

export function readSessionToken(req: Request): string | null {
  const cookie = req.headers.cookie ?? '';
  const match = cookie.match(new RegExp(`${config.sessionCookieName}=([^;]+)`));
  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

export function setSessionCookie(res: Response, token: string, options: SessionCookieOptions = {}): void {
  res.setHeader('Set-Cookie', buildSessionCookieHeader(token, options));
}

export function refreshSessionCookie(res: Response, payload: SessionPayload, req?: Request): void {
  const persistent = payload.persistent !== false;
  const token = createSessionToken({
    userId: payload.userId,
    email: payload.email,
    persistent,
  });
  setSessionCookie(res, token, { persistent, req });
}

export function clearSessionCookie(res: Response): void {
  res.setHeader('Set-Cookie', buildClearSessionCookieHeader());
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const raw = readSessionToken(req);
  if (!raw) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const payload = verifySessionToken(raw);
  if (!payload) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }
  req.auth = payload;
  next();
}
