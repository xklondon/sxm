export type AuthErrorCode = 'SESSION_INVALID' | 'ACCESS_DENIED' | 'NOT_REGISTERED' | 'UNKNOWN';

export class AuthFetchError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number;

  constructor(status: number, message: string, code: AuthErrorCode = 'UNKNOWN') {
    super(message);
    this.name = 'AuthFetchError';
    this.status = status;
    this.code = code;
  }
}

export function authErrorCodeFromBody(body: { code?: string } | null): AuthErrorCode {
  const code = body?.code;
  if (code === 'SESSION_INVALID' || code === 'ACCESS_DENIED' || code === 'NOT_REGISTERED') {
    return code;
  }
  return 'UNKNOWN';
}

/** True when the rejection should not trigger the global boot crash overlay. */
export function isHandledAuthRejection(reason: unknown): boolean {
  if (reason instanceof AuthFetchError) {
    return true;
  }
  if (reason instanceof Error) {
    const msg = reason.message.toLowerCase();
    return (
      msg.includes('not registered') ||
      msg.includes('ask an admin') ||
      msg.includes('session expired') ||
      msg.includes('authentication required') ||
      msg.includes('access required')
    );
  }
  return false;
}

export function accessDeniedMessage(code: AuthErrorCode): string {
  if (code === 'NOT_REGISTERED' || code === 'ACCESS_DENIED') {
    return 'Access required — ask an admin for an invite.';
  }
  return 'Sign in to continue.';
}
