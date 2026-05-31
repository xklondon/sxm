/** Derive 1–2 letter initials from name and optional email (local display only). */
export function deriveInitials(name: string, email?: string): string {
  const trimmed = name.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
    }
    if (parts[0]!.length >= 2) {
      return parts[0]!.slice(0, 2).toUpperCase();
    }
    return parts[0]!.slice(0, 1).toUpperCase();
  }
  const mail = email?.trim();
  if (mail && mail.includes('@')) {
    const local = mail.split('@')[0] ?? '';
    if (local.length >= 2) {
      return local.slice(0, 2).toUpperCase();
    }
    return local.slice(0, 1).toUpperCase();
  }
  return '?';
}
