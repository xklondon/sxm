import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => {}),
  sendTableInviteEmail: vi.fn(async () => ({ messageId: 'test-message-id' })),
}));

const envBackup = { ...process.env };

beforeEach(() => {
  process.env.IOU_HANDOFF_SECRET = 'test-partner-secret';
  process.env.IOU_HANDOFF_CREATE_URL = 'https://iou.example.com/create';
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...envBackup };
  vi.resetModules();
});

describe('POST /api/iou-handoff/create — tableId verification', () => {
  it('fails closed (403) when the referenced table exists but caller is not a member', async () => {
    const { createApp } = await import('../src/app.js');
    const { createMemoryStore } = await import('../src/store/memoryStore.js');
    const { createSessionToken } = await import('../src/auth/tokens.js');
    const { seedHostUser } = await import('./testHelpers.js');

    const store = createMemoryStore();
    const { app, tables } = createApp({ store });
    const host = await seedHostUser(store, 'host@example.com');
    const table = await tables.createTable(host.id, 'Host', 'Room', 'host@example.com');
    const outsider = await store.createUser('outsider@example.com', 'Outsider');

    const res = await request(app)
      .post('/api/iou-handoff/create')
      .set(
        'Authorization',
        `Bearer ${createSessionToken({ userId: outsider.id, email: outsider.email })}`,
      )
      .send({
        tableId: table.id,
        debtorEmail: 'outsider@example.com',
        creditorEmail: 'someone@example.com',
        title: '$5',
        wagerText: '$5',
        gameId: 'g1',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not a member/i);
  });

  it('unknown tableId still falls back to the offline/local body path', async () => {
    const { createApp } = await import('../src/app.js');
    const { createMemoryStore } = await import('../src/store/memoryStore.js');
    const { createSessionToken } = await import('../src/auth/tokens.js');

    const store = createMemoryStore();
    const { app } = createApp({ store });
    const user = await store.createUser('viewer@example.com', 'Viewer');

    const res = await request(app)
      .post('/api/iou-handoff/create')
      .set(
        'Authorization',
        `Bearer ${createSessionToken({ userId: user.id, email: user.email })}`,
      )
      .send({
        tableId: 'local-table-does-not-exist',
        debtorEmail: 'viewer@example.com',
        creditorEmail: 'friend@example.com',
        title: '$5',
        wagerText: '$5',
        gameId: 'g1',
      });

    // Must NOT be the membership fail-closed error; the offline fallback
    // proceeds into normal handoff processing (whose outcome depends on the
    // partner endpoint — anything but 403 membership rejection is fine here).
    expect(res.status).not.toBe(403);
  });
});
