import { describe, expect, it } from 'vitest';
import { AuthFetchError, isHandledAuthRejection } from './authErrors';

describe('auth bootstrap error handling', () => {
  it('403 AuthFetchError is treated as handled (no boot crash overlay)', () => {
    const err = new AuthFetchError(403, 'Access required — ask an admin for an invite.', 'NOT_REGISTERED');
    expect(isHandledAuthRejection(err)).toBe(true);
  });

  it('registration errors from API messages are handled', () => {
    expect(isHandledAuthRejection(new Error('Your account is not registered on this platform.'))).toBe(
      true,
    );
  });

  it('unexpected errors are not handled', () => {
    expect(isHandledAuthRejection(new Error('Something else broke'))).toBe(false);
  });
});
