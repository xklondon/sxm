import { vi } from 'vitest';

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => undefined),
  sendTableInviteEmail: vi.fn(async () => undefined),
}));
