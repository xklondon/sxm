import type { Response } from 'express';
import { isPeopleAuthError, peopleAuthHttpStatus } from '../people/errors.js';
import { clearSessionCookie } from '../auth/middleware.js';
import { inviteFlowHttpStatus, isInviteFlowError } from '../people/inviteErrors.js';

export function respondInviteOrPeopleError(res: Response, err: unknown): boolean {
  if (isInviteFlowError(err)) {
    res.status(inviteFlowHttpStatus(err.code)).json({ error: err.message, code: err.code });
    return true;
  }
  if (isPeopleAuthError(err)) {
    const status = peopleAuthHttpStatus(err.code);
    if (status === 401) {
      clearSessionCookie(res);
    }
    res.status(status).json({ error: err.message, code: err.code });
    return true;
  }
  return false;
}
