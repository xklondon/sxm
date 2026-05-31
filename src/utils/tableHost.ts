function normalizeHostUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/$/, '');
  }
  return `http://${trimmed.replace(/\/$/, '')}`;
}

/**
 * Origin for invite/join links. Prefers an explicit VITE_TABLE_HOST, then the
 * actual page origin (LAN IP when hosting / served over Wi-Fi). No hardcoded IPs.
 */
export function getTableInviteOrigin(): string {
  const configured = import.meta.env.VITE_TABLE_HOST as string | undefined;
  if (configured?.trim()) {
    return normalizeHostUrl(configured);
  }

  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/$/, '');
  }

  return '';
}

export function isEmailInviteConfigured(): boolean {
  return import.meta.env.VITE_EMAIL_INVITES === 'true';
}
