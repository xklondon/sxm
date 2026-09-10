import { describe, expect, it, afterEach, vi } from 'vitest';

vi.mock('../src/email/mailer.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => {}),
  sendTableInviteEmail: vi.fn(async () => ({ messageId: 'test-message-id' })),
}));

import { io as ioClient, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createSessionToken } from '../src/auth/tokens.js';
import { broadcastTableUpdate } from '../src/tables/broadcast.js';
import { seedHostUser } from './testHelpers.js';

function connect(port: number, token: string): Socket {
  return ioClient(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    extraHeaders: { Authorization: `Bearer ${token}` },
    reconnection: false,
  });
}

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('socket table:subscribe membership gate', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length) {
      cleanups.pop()!();
    }
  });

  it('member receives table:update; non-member is denied and receives nothing', async () => {
    const store = createMemoryStore();
    const { httpServer, io, tables } = createApp({ store });
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    cleanups.push(() => {
      io.close();
      httpServer.close();
    });
    const port = (httpServer.address() as AddressInfo).port;

    const host = await seedHostUser(store, 'host@example.com');
    const table = await tables.createTable(host.id, 'Host', 'Room', 'host@example.com');
    const stranger = await store.createUser('stranger@example.com', 'Stranger');

    const hostSocket = connect(port, createSessionToken({ userId: host.id, email: host.email }));
    const strangerSocket = connect(
      port,
      createSessionToken({ userId: stranger.id, email: stranger.email }),
    );
    cleanups.push(() => {
      hostSocket.disconnect();
      strangerSocket.disconnect();
    });

    await Promise.all([
      waitForEvent(hostSocket, 'connect'),
      waitForEvent(strangerSocket, 'connect'),
    ]);

    hostSocket.emit('table:subscribe', table.id);
    strangerSocket.emit('table:subscribe', table.id);

    const denied = waitForEvent<{ tableId: string }>(strangerSocket, 'table:subscribe:denied');
    await expect(denied).resolves.toMatchObject({ tableId: table.id });

    let strangerGotUpdate = false;
    strangerSocket.on('table:update', () => {
      strangerGotUpdate = true;
    });

    const hostUpdate = waitForEvent<{ tableId: string }>(hostSocket, 'table:update');
    broadcastTableUpdate(io, table.id, table.version + 1, table.state);
    await expect(hostUpdate).resolves.toMatchObject({ tableId: table.id });

    // Give any (wrong) delivery to the stranger a moment to land.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(strangerGotUpdate).toBe(false);
  });
});
