import type { Request, Response } from 'express';
import type { PeopleService } from '../people/service.js';
import { refreshSessionCookie } from './middleware.js';
import type { SessionPayload } from './tokens.js';
import { respondPeopleAuthError } from '../people/httpErrors.js';
import { isPeopleAuthError } from '../people/errors.js';

/** Resolve stale session userId from email; refresh cookie when id changes. */
export function resolveAuthForRequest(
  people: PeopleService,
  auth: SessionPayload,
  res: Response,
  req: Request,
  route: string,
): SessionPayload | null {
  try {
    const user = people.resolveSessionUser(auth.userId, auth.email, route);
    if (user.id !== auth.userId) {
      const next: SessionPayload = { ...auth, userId: user.id };
      refreshSessionCookie(res, next, req);
      return next;
    }
    return auth;
  } catch (err) {
    if (isPeopleAuthError(err)) {
      respondPeopleAuthError(res, err);
      return null;
    }
    throw err;
  }
}
