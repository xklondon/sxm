export type InviteFlowErrorCode =
  | 'INVITE_EMAIL_MISMATCH'
  | 'INVITE_PERSON_DISABLED'
  | 'INVITE_DUPLICATE_ACCOUNTS'
  | 'INVITE_INVALID'
  | 'INVITE_EXPIRED'
  | 'INVITE_JOIN_DENIED';

export class InviteFlowError extends Error {
  readonly code: InviteFlowErrorCode;

  constructor(code: InviteFlowErrorCode, message: string) {
    super(message);
    this.name = 'InviteFlowError';
    this.code = code;
  }
}

export function isInviteFlowError(err: unknown): err is InviteFlowError {
  return err instanceof InviteFlowError;
}

export function inviteFlowHttpStatus(code: InviteFlowErrorCode): number {
  switch (code) {
    case 'INVITE_INVALID':
    case 'INVITE_EXPIRED':
      return 400;
    case 'INVITE_EMAIL_MISMATCH':
    case 'INVITE_PERSON_DISABLED':
    case 'INVITE_DUPLICATE_ACCOUNTS':
    case 'INVITE_JOIN_DENIED':
      return 403;
    default:
      return 400;
  }
}
