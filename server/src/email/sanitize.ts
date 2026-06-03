/** Sanitized recipient for logs (never full address in production logs). */
export function sanitizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf('@');
  if (at < 1) {
    return '(invalid)';
  }
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  return `${local[0]}***@${domain}`;
}
