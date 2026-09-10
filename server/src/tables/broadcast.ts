import type { Server as SocketServer } from 'socket.io';
import type { GameState } from '../../../src/types/index.js';
import { redactStateForViewer } from './redactState.js';

export interface TableUpdatePayload {
  tableId: string;
  version: number;
  state: GameState;
}

/** Maps a socket's authenticated userId to their member personId at the table. */
export type BroadcastPersonResolver = (userId: string) => string | null;

/**
 * Push table state to every client subscribed to the table room, redacted
 * per viewer (hidden cards / deck order never leave the server — same rules
 * as the HTTP responses, see redactState.ts).
 */
export function broadcastTableUpdate(
  io: SocketServer,
  tableId: string,
  version: number,
  state: GameState,
  resolvePersonId?: BroadcastPersonResolver,
): void {
  void (async () => {
    try {
      const sockets = await io.in(`table:${tableId}`).fetchSockets();
      const byPerson = new Map<string | null, GameState>();
      for (const socket of sockets) {
        const userId = socket.data.userId as string | undefined;
        const personId = (userId && resolvePersonId?.(userId)) || null;
        let redacted = byPerson.get(personId);
        if (!redacted) {
          redacted = redactStateForViewer(state, personId);
          byPerson.set(personId, redacted);
        }
        const payload: TableUpdatePayload = { tableId, version, state: redacted };
        socket.emit('table:update', payload);
      }
    } catch {
      // Socket layer failures must never break the HTTP action path.
    }
  })();
}
