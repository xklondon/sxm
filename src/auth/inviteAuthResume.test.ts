import { describe, expect, it } from 'vitest';
import {
  buildInviteAuthResumePath,
  isSafeInviteResumePath,
  normalizeInviteReturnTo,
  resolveLoginMagicReturnTo,
  resolvePostAuthInviteResume,
} from './inviteAuthResume';

describe('invite auth resume', () => {
  it('builds a token-only join-table resume path', () => {
    expect(buildInviteAuthResumePath('abc+def')).toBe('/join-table?token=abc%2Bdef');
  });

  it('magic-link return target survives the login query round trip', () => {
    const resume = buildInviteAuthResumePath('invite-token-1');
    const loginSearch = `?invitedEmail=guest%40example.com&returnTo=${encodeURIComponent(resume)}`;
    expect(resolveLoginMagicReturnTo({ pathname: '/login', search: loginSearch })).toBe(resume);
    expect(resolvePostAuthInviteResume({ search: loginSearch, pendingJoin: null })).toBe(resume);
  });

  it('production-style absolute callback keeps the invite token', () => {
    const absolute = 'https://play.sxmcards.example/join-table?token=prod-token-9';
    expect(normalizeInviteReturnTo(absolute)).toBe('/join-table?token=prod-token-9');
    expect(
      resolveLoginMagicReturnTo({
        pathname: '/login',
        search: `?returnTo=${encodeURIComponent(absolute)}`,
      }),
    ).toBe('/join-table?token=prod-token-9');
  });

  it('rejects unsafe return targets', () => {
    expect(isSafeInviteResumePath('https://evil.example/join-table?token=x')).toBe(false);
    expect(normalizeInviteReturnTo('/login?token=x')).toBeNull();
    expect(normalizeInviteReturnTo('/join-table')).toBeNull();
  });

  it('join-table path itself is the magic return target when unauthenticated', () => {
    expect(
      resolveLoginMagicReturnTo({
        pathname: '/join-table',
        search: '?token=from-join',
      }),
    ).toBe('/join-table?token=from-join');
  });
});
