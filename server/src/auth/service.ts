import type { Store } from '../store/types.js';
import type { PeopleService } from '../people/service.js';
import { config, getEffectivePublicOrigin, isEmailConfigured } from '../config.js';
import { createMagicLinkToken, createSessionToken } from './tokens.js';
import { sendMagicLinkEmail } from '../email/mailer.js';
import { logSmtpContext, sanitizeEmail } from '../email/smtp.js';

export class AuthService {
  constructor(
    private readonly store: Store,
    private readonly people: PeopleService,
  ) {}

  async requestMagicLink(email: string, rememberMe = true): Promise<{ ok: true; devLink?: string }> {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@')) {
      throw new Error('Valid email required');
    }

    if (!(await this.people.canRequestMagicLink(normalized))) {
      throw new Error('This email is not registered or authorised. Ask an admin for an invite.');
    }

    const last = await this.store.lastMagicLinkRequestAt(normalized);
    if (last) {
      const elapsed = Date.now() - new Date(last).getTime();
      if (elapsed < config.magicLinkResendCooldownMs) {
        throw new Error('Please wait before requesting another link');
      }
    }

    if (config.isProduction && !isEmailConfigured()) {
      throw new Error('Email server must be configured in production');
    }

    const token = createMagicLinkToken();
    const expiresAt = new Date(Date.now() + config.magicLinkTtlMs).toISOString();
    await this.store.createMagicLink(normalized, token, expiresAt);
    await this.store.setLastMagicLinkRequestAt(normalized, new Date().toISOString());

    const rememberParam = rememberMe ? 'remember=1' : 'remember=0';
    const verifyPath = `/api/auth/verify?token=${encodeURIComponent(token)}&${rememberParam}`;
    const verifyUrl = `${getEffectivePublicOrigin().replace(/\/$/, '')}${verifyPath}`;
    // eslint-disable-next-line no-console
    console.log(
      `[SXM][auth] magic-link token created recipient=${sanitizeEmail(normalized)} verifyHost=${new URL(verifyUrl).host}`,
    );
    logSmtpContext('request-magic-link');
    try {
      await sendMagicLinkEmail(normalized, verifyUrl);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[SXM][auth] magic-link email failed recipient=${sanitizeEmail(normalized)}`);
      throw err;
    }

    if (!config.isProduction) {
      console.log(`[SXMCards dev] Magic link for ${normalized}: ${verifyUrl}`);
    }

    return {
      ok: true,
      devLink: config.isProduction ? undefined : verifyPath,
    };
  }

  async verifyMagicLink(token: string, options?: { persistent?: boolean }): Promise<string> {
    const link = await this.store.getMagicLink(token);
    if (!link) {
      throw new Error('Invalid or unknown token');
    }
    if (link.usedAt) {
      throw new Error('Token already used');
    }
    if (new Date(link.expiresAt).getTime() < Date.now()) {
      throw new Error('Token expired');
    }

    await this.store.markMagicLinkUsed(token);
    const user = await this.store.createUser(link.email, link.email.split('@')[0]!);
    await this.people.ensurePersonOnLogin(link.email, user.id);
    const persistent = options?.persistent !== false;
    return createSessionToken({ userId: user.id, email: user.email, persistent });
  }
}
