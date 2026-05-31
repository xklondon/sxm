import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { verifySessionToken, type SessionPayload } from './tokens.js';

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

export function setSessionCookie(res: Response, token: string): void {
  const secure = config.isProduction ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${config.sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(config.sessionMaxAgeMs / 1000)}${secure}`,
  );
}

export function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${config.sessionCookieName}=; HttpOnly; Path=/; Max-Age=0`,
  );
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
