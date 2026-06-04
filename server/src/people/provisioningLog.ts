import { sanitizeEmail } from '../email/smtp.js';

export type AuthProvisionPath =
  | 'resolve-by-id'
  | 'resolve-by-email'
  | 'create-user'
  | 'ensure-person-login'
  | 'ensure-root'
  | 'ensure-invite-guest'
  | 'get-auth-profile';

export function logAuthProvision(
  route: string,
  path: AuthProvisionPath,
  sessionEmail: string | undefined,
  detail: Record<string, string | boolean | null | undefined>,
): void {
  const email = sessionEmail ? sanitizeEmail(sessionEmail) : '(none)';
  const parts = Object.entries(detail)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${String(v)}`);
  // eslint-disable-next-line no-console
  console.log(`[SXM][auth-provision] route=${route} path=${path} sessionEmail=${email} ${parts.join(' ')}`);
}
