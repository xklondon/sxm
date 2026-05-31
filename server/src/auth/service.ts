import type { Store } from '../store/types.js';
import type { PeopleService } from '../people/service.js';
import { config, getEffectivePublicOrigin } from '../config.js';
import { createMagicLinkToken, createSessionToken } from './tokens.js';
import { sendMagicLinkEmail } from '../email/mailer.js';
import { isSmtpConfigured } from '../config.js';

export class AuthService {
  constructor(
    private readonly store: Store,
    private readonly people: PeopleService,
  ) {}

  async requestMagicLink(email: string): Promise<{ ok: true; devLink?: string }> {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@')) {
      throw new Error('Valid email required');
    }

    if (!this.people.canRequestMagicLink(normalized)) {
      throw new Error('This email is not authorised for this table/app.');
    }

    const last = this.store.lastMagicLinkRequestAt(normalized);
    if (last) {
      const elapsed = Date.now() - new Date(last).getTime();
      if (elapsed < config.magicLinkResendCooldownMs) {
        throw new Error('Please wait before requesting another link');
      }
    }

    if (config.isProduction && !isSmtpConfigured()) {
      throw new Error('Email server must be configured in production');
    }

    const token = createMagicLinkToken();
    const expiresAt = new Date(Date.now() + config.magicLinkTtlMs).toISOString();
    this.store.createMagicLink(normalized, token, expiresAt);
    this.store.setLastMagicLinkRequestAt(normalized, new Date().toISOString());

    const verifyUrl = `${getEffectivePublicOrigin().replace(/\/$/, '')}/api/auth/verify?token=${encodeURIComponent(token)}`;
    await sendMagicLinkEmail(normalized, verifyUrl);

    if (!config.isProduction) {
      console.log(`[SXMCards dev] Magic link for ${normalized}: ${verifyUrl}`);
    }

    return {
      ok: true,
      devLink: config.isProduction ? undefined : verifyUrl,
    };
  }

  verifyMagicLink(token: string): string {
    const link = this.store.getMagicLink(token);
    if (!link) {
      throw new Error('Invalid or unknown token');
    }
    if (link.usedAt) {
      throw new Error('Token already used');
    }
    if (new Date(link.expiresAt).getTime() < Date.now()) {
      throw new Error('Token expired');
    }

    this.store.markMagicLinkUsed(token);
    const user = this.store.createUser(link.email, link.email.split('@')[0]!);
    this.people.ensurePersonOnLogin(link.email, user.id);
    return createSessionToken({ userId: user.id, email: user.email });
  }
}
