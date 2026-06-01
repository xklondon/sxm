function normalizeHostUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/$/, '');
  }
  return `http://${trimmed.replace(/\/$/, '')}`;
}

/**
 * Pure resolver for the invite/join origin. Prefers an explicit configured host,
 * then the page origin. Kept side-effect free so callers/tests never need to
 * mutate `import.meta.env` (which is a read-only build constant in production).
 */
export function resolveTableInviteOrigin(
  configuredHost: string | undefined,
  pageOrigin: string | null,
): string {
  if (configuredHost?.trim()) {
    return normalizeHostUrl(configuredHost);
  }
  if (pageOrigin) {
    return pageOrigin.replace(/\/$/, '');
  }
  return '';
}

/**
 * Origin for invite/join links. Prefers an explicit VITE_TABLE_HOST, then the
 * actual page origin (LAN IP when hosting / served over Wi-Fi). No hardcoded IPs.
 */
export function getTableInviteOrigin(): string {
  return resolveTableInviteOrigin(
    import.meta.env.VITE_TABLE_HOST as string | undefined,
    typeof window !== 'undefined' ? window.location.origin : null,
  );
}

export function isEmailInviteConfigured(): boolean {
  return import.meta.env.VITE_EMAIL_INVITES === 'true';
}
