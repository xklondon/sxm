export type PeopleAuthErrorCode = 'SESSION_INVALID' | 'ACCESS_DENIED' | 'NOT_REGISTERED';

export class PeopleAuthError extends Error {
  readonly code: PeopleAuthErrorCode;

  constructor(code: PeopleAuthErrorCode, message: string) {
    super(message);
    this.name = 'PeopleAuthError';
    this.code = code;
  }
}

export function isPeopleAuthError(err: unknown): err is PeopleAuthError {
  return err instanceof PeopleAuthError;
}

export function peopleAuthHttpStatus(code: PeopleAuthErrorCode): number {
  return code === 'SESSION_INVALID' ? 401 : 403;
}
