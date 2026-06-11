import { createHash } from 'node:crypto';
import {
  buildIouCreatePayload,
  buildIouHandoffNonceMaterial,
  type IouCreatePayload,
  type IouCreatePayloadInput,
} from '../../../src/lib/iouHandoffPayload.js';

/** Deterministic idempotency nonce for a completed game wager handoff. */
export function buildIouHandoffNonce(parts: {
  tableId: string;
  gameId: string;
  debtorEmail: string;
  creditorEmail: string;
  wager: string;
}): string {
  return createHash('sha256')
    .update(buildIouHandoffNonceMaterial(parts), 'utf8')
    .digest('hex');
}

export function buildServerIouCreatePayload(
  input: Omit<IouCreatePayloadInput, 'nonce'>,
): IouCreatePayload {
  const nonce = buildIouHandoffNonce({
    tableId: input.tableId,
    gameId: input.gameId,
    debtorEmail: input.debtorEmail,
    creditorEmail: input.creditorEmail,
    wager: input.wagerText,
  });
  return buildIouCreatePayload({ ...input, nonce });
}

export type { IouCreatePayload };
