import type { Response } from 'express';
import { clearSessionCookie } from '../auth/middleware.js';
import { isPeopleAuthError, peopleAuthHttpStatus } from './errors.js';

export function respondPeopleAuthError(res: Response, err: unknown): boolean {
  if (!isPeopleAuthError(err)) {
    return false;
  }
  const status = peopleAuthHttpStatus(err.code);
  if (status === 401) {
    clearSessionCookie(res);
  }
  res.status(status).json({ error: err.message, code: err.code });
  return true;
}
