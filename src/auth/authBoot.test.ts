import { describe, expect, it } from 'vitest';
import { isPublicAuthPath, shouldShowGlobalSessionLoading } from './authBoot';

describe('auth boot routing', () => {
  it('/login is public during session check', () => {
    expect(isPublicAuthPath('/login')).toBe(true);
    expect(shouldShowGlobalSessionLoading('/login', true, true)).toBe(false);
  });

  it('/join-table is public during session check', () => {
    expect(isPublicAuthPath('/join-table')).toBe(true);
    expect(shouldShowGlobalSessionLoading('/join-table', true, true)).toBe(false);
  });

  it('protected routes block on session check', () => {
    expect(shouldShowGlobalSessionLoading('/', true, true)).toBe(true);
    expect(shouldShowGlobalSessionLoading('/', false, true)).toBe(false);
  });
});
