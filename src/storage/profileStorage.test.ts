import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildProfile,
  loadProfile,
  needsLocalProfileSetup,
  saveProfile,
} from './profileStorage';

describe('profileStorage online setup', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
      },
    });
  });

  it('returns default profile when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined as unknown as Storage);
    expect(loadProfile()).toEqual({
      name: '',
      email: '',
      initials: '?',
      playFlow: 'auto-18',
    });
  });

  it('syncs auth email and only requires display name online', () => {
    saveProfile(buildProfile('', '', 'manual'));
    expect(needsLocalProfileSetup(true, 'guest@example.com')).toBe(true);
    expect(loadProfile().email).toBe('guest@example.com');
    saveProfile(buildProfile('Guest Player', 'guest@example.com', 'manual'));
    expect(needsLocalProfileSetup(true, 'guest@example.com')).toBe(false);
  });
});
