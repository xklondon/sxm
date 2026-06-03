import { deriveInitials } from '../utils/initials';
import { log } from '../utils/logger';

const STORAGE_KEY = 'sxmcards:profile:v1';

export type PlayFlowAutoStand = 'manual' | 'auto-18' | 'auto-19' | 'auto-20' | 'auto-21';

export const PLAY_FLOW_OPTIONS: { value: PlayFlowAutoStand; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'auto-18', label: 'Auto-stand on 18+' },
  { value: 'auto-19', label: 'Auto-stand on 19+' },
  { value: 'auto-20', label: 'Auto-stand on 20+' },
  { value: 'auto-21', label: 'Auto-stand on 21' },
];

export interface LocalProfile {
  name: string;
  email: string;
  initials: string;
  playFlow: PlayFlowAutoStand;
}

export function defaultProfile(): LocalProfile {
  return { name: '', email: '', initials: '?', playFlow: 'auto-18' };
}

export function buildProfile(
  name: string,
  email: string,
  playFlow: PlayFlowAutoStand = 'auto-18',
): LocalProfile {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  return {
    name: trimmedName,
    email: trimmedEmail,
    initials: deriveInitials(trimmedName, trimmedEmail),
    playFlow,
  };
}

export function loadProfile(): LocalProfile {
  if (typeof localStorage === 'undefined') {
    return defaultProfile();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultProfile();
    }
    const parsed = JSON.parse(raw) as Partial<LocalProfile>;
    return buildProfile(parsed.name ?? '', parsed.email ?? '', parsed.playFlow ?? 'auto-18');
  } catch (err) {
    log.warn('Failed to load profile', { err });
    return defaultProfile();
  }
}

export function saveProfile(profile: LocalProfile): void {
  const next = buildProfile(profile.name, profile.email, profile.playFlow);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    log.info('Profile saved', { initials: next.initials });
  } catch (err) {
    log.warn('Failed to save profile', { err });
  }
}

export function needsLocalProfileSetup(onlineMode: boolean, authEmail?: string | null): boolean {
  const profile = loadProfile();
  if (onlineMode) {
    if (authEmail && !profile.email.trim()) {
      saveProfile(buildProfile(profile.name, authEmail, profile.playFlow));
    }
    return !profile.name.trim();
  }
  return !profile.name.trim();
}

export function syncAuthEmailToProfile(authEmail: string): LocalProfile {
  const profile = loadProfile();
  if (profile.email.trim().toLowerCase() === authEmail.trim().toLowerCase()) {
    return profile;
  }
  const next = buildProfile(profile.name, authEmail, profile.playFlow);
  saveProfile(next);
  return next;
}

export function getPlayerInitials(name: string, email?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.toLowerCase() === 'guest') {
    return null;
  }
  if (/^box \d+$/i.test(trimmed)) {
    return null;
  }
  const ini = deriveInitials(trimmed, email);
  return ini === '?' ? null : ini;
}
