import { createHash } from 'node:crypto';
import {
  buildIouCreatePayload,
  buildIouHandoffNonceMaterial,
  buildPokerChallengeIouGameId,
  buildPokerChallengeIouNonceMaterial,
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

export function buildPokerChallengeIouNonce(parts: {
  tableId: string;
  gameId: string;
  debtorEmail: string;
  creditorEmail: string;
  settlementAmount: string;
}): string {
  return createHash('sha256')
    .update(buildPokerChallengeIouNonceMaterial(parts), 'utf8')
    .digest('hex');
}

export type ServerIouCreatePayloadInput = Omit<IouCreatePayloadInput, 'nonce'> & {
  challengeHandNumber?: number;
  settlementAmount?: number;
};

export function buildServerIouCreatePayload(input: ServerIouCreatePayloadInput): IouCreatePayload {
  const tableId = input.tableId.trim();
  const gameId =
    input.challengeHandNumber !== undefined
      ? buildPokerChallengeIouGameId(tableId, input.challengeHandNumber)
      : input.gameId.trim();

  const nonce =
    input.challengeHandNumber !== undefined && input.settlementAmount !== undefined
      ? buildPokerChallengeIouNonce({
          tableId,
          gameId,
          debtorEmail: input.debtorEmail,
          creditorEmail: input.creditorEmail,
          settlementAmount: formatPokerSettlementAmount(input.settlementAmount),
        })
      : buildIouHandoffNonce({
          tableId,
          gameId,
          debtorEmail: input.debtorEmail,
          creditorEmail: input.creditorEmail,
          wager: input.wagerText,
        });

  return buildIouCreatePayload({ ...input, gameId, nonce });
}

function formatPokerSettlementAmount(amount: number): string {
  return amount.toFixed(2);
}

export { buildPokerChallengeIouGameId };

export type { IouCreatePayload };
