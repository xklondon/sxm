import type { Server as SocketServer } from 'socket.io';
import type { GameState } from '../../../src/types/index.js';

export interface TableUpdatePayload {
  tableId: string;
  version: number;
  state: GameState;
}

/** Push full table state to every client subscribed to the table room. */
export function broadcastTableUpdate(
  io: SocketServer,
  tableId: string,
  version: number,
  state: GameState,
): void {
  const payload: TableUpdatePayload = { tableId, version, state };
  io.to(`table:${tableId}`).emit('table:update', payload);
}
