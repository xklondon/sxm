import { vi } from 'vitest';
import { setLogLevel } from '../../src/utils/logger';

process.env.NODE_ENV ??= 'test';
setLogLevel('warn');

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => undefined),
  sendTableInviteEmail: vi.fn(async () => undefined),
}));
