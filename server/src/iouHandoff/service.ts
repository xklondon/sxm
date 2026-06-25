import type { GameState } from '../../../src/types/index.js';
import {
  buildServerIouCreatePayload,
  type IouCreatePayload,
} from '../lib/iouHandoffPayload.js';
import type { IouHandoffCreateRequestBody } from '../../../src/lib/iouHandoffPayload.js';
import {
  resolveGameEndParties,
  resolveWinnerDisplayName,
} from '../../../src/engine/scoreLedger/gameEndIou.js';
import { sendIouCreateHandoff, type IouHandoffRemoteConfig } from '../lib/iouHandoffCrypto.js';

export interface IouHandoffServiceConfig extends IouHandoffRemoteConfig {
  enabled: boolean;
}

export interface IouHandoffCreateResult {
  ok: true;
  iouId: string;
  status: string;
  message: string;
  alreadySubmitted?: boolean;
  openUrl?: string;
}

interface StoredHandoff {
  iouId: string;
  status: string;
  message: string;
  openUrl?: string;
  submittedAt: string;
}

export class IouHandoffService {
  private readonly submittedByNonce = new Map<string, StoredHandoff>();

  constructor(private readonly config: IouHandoffServiceConfig) {}

  isConfigured(): boolean {
    return this.config.enabled;
  }

  async createFromRequest(
    viewerEmail: string,
    body: IouHandoffCreateRequestBody,
    tableState?: GameState | null,
  ): Promise<IouHandoffCreateResult> {
    if (!this.config.enabled) {
      throw new Error('IOU handoff is not configured on this server.');
    }

    const normalizedViewer = viewerEmail.trim().toLowerCase();
    if (!normalizedViewer) {
      throw new Error('Authentication required');
    }

    const resolved = resolveHandoffParties(body, tableState);
    try {
      validateHandoffParties(resolved, normalizedViewer, tableState, body);
    } catch (err) {
      logHandoffRejection({
        tableId: resolved.tableId,
        sessionId: resolved.sessionId,
        viewerEmail: normalizedViewer,
        debtorEmailPresent: Boolean(resolved.debtorEmail),
        creditorEmailPresent: Boolean(resolved.creditorEmail),
        rejectionReason: err instanceof Error ? err.message : 'IOU handoff validation failed',
        tableState,
      });
      throw err;
    }

    const payload = buildServerIouCreatePayload({
      source: this.config.source,
      debtorEmail: resolved.debtorEmail,
      creditorEmail: resolved.creditorEmail,
      debtorName: resolved.debtorName,
      creditorName: resolved.creditorName,
      title: resolved.title,
      wagerText: resolved.wagerDescription,
      tableId: resolved.tableId,
      gameId: resolved.sessionId,
      gameType: resolved.gameType,
      message: body.message?.trim() || undefined,
      challengeHandNumber: body.challengeHandNumber,
      settlementAmount: body.settlementAmount,
    });

    const cached = this.submittedByNonce.get(payload.nonce);
    if (cached) {
      return {
        ok: true,
        iouId: cached.iouId,
        status: cached.status,
        message: 'This IOU handoff was already submitted.',
        alreadySubmitted: true,
        openUrl: cached.openUrl,
      };
    }

    const remote = await sendIouCreateHandoff(payload, this.config);
    if (!remote.ok) {
      if (remote.duplicate) {
        return rememberDuplicate(this.submittedByNonce, payload, remote.error);
      }
      throw new Error(remote.error);
    }

    const stored: StoredHandoff = {
      iouId: remote.iouId,
      status: remote.status,
      message: remote.message,
      openUrl: remote.openUrl,
      submittedAt: new Date().toISOString(),
    };
    this.submittedByNonce.set(payload.nonce, stored);

    // eslint-disable-next-line no-console
    console.info('[SXM][iou-handoff] submitted', {
      source: this.config.source,
      tableId: resolved.tableId,
      gameId: resolved.sessionId,
      status: remote.status,
      iouId: remote.iouId,
    });

    return {
      ok: true,
      iouId: remote.iouId,
      status: remote.status,
      message: remote.message,
      openUrl: remote.openUrl,
    };
  }
}

interface ResolvedHandoffParties {
  tableId: string;
  sessionId: string;
  wagerDescription: string;
  debtorEmail: string;
  creditorEmail: string;
  debtorName?: string;
  creditorName?: string;
  gameType: string;
  title: string;
}

function resolveHandoffParties(
  body: IouHandoffCreateRequestBody,
  tableState?: GameState | null,
): ResolvedHandoffParties {
  const tableId = body.tableId?.trim();
  const sessionId = body.sessionId?.trim();
  if (!tableId || !sessionId) {
    throw new Error('tableId and sessionId are required');
  }

  if (tableState?.tableMeta.gameStatus === 'ended') {
    const parties = resolveGameEndParties(tableState);
    if (parties?.winnerEmail && parties.loserEmail) {
      const wager =
        tableState.tableMeta.agreement?.stakeDescription?.trim() ||
        body.wagerDescription?.trim() ||
        'Blackjack wager';
      return {
        tableId,
        sessionId,
        wagerDescription: wager,
        debtorEmail: parties.loserEmail,
        creditorEmail: parties.winnerEmail,
        debtorName: body.debtorName?.trim() || undefined,
        creditorName:
          body.creditorName?.trim() ||
          resolveWinnerDisplayName(tableState, parties.winnerId),
        gameType: body.gameType?.trim() || tableState.tableGame || 'blackjack',
        title: body.title?.trim() || wager,
      };
    }
  }

  const debtorEmail = body.debtorEmail?.trim().toLowerCase();
  const creditorEmail = body.creditorEmail?.trim().toLowerCase();
  const wagerDescription = body.wagerDescription?.trim();
  if (!debtorEmail || !creditorEmail || !wagerDescription) {
    throw new Error('debtorEmail, creditorEmail, and wagerDescription are required');
  }

  return {
    tableId,
    sessionId,
    wagerDescription,
    debtorEmail,
    creditorEmail,
    debtorName: body.debtorName?.trim() || undefined,
    creditorName: body.creditorName?.trim() || undefined,
    gameType: body.gameType?.trim() || 'blackjack',
    title: body.title?.trim() || wagerDescription,
  };
}

function validateHandoffParties(
  parties: ResolvedHandoffParties,
  viewerEmail: string,
  tableState?: GameState | null,
  body?: IouHandoffCreateRequestBody,
): void {
  if (!parties.debtorEmail || !parties.creditorEmail) {
    throw new Error('Debtor and creditor emails are required');
  }
  if (parties.debtorEmail === parties.creditorEmail) {
    throw new Error('Debtor and creditor must be different people');
  }

  const gameType = parties.gameType.trim().toLowerCase();
  if (gameType === 'texas-holdem' && tableState?.tableMeta.pokerConfig) {
    const config = tableState.tableMeta.pokerConfig;
    if (config.mode === 'practice') {
      throw new Error('Practice poker tables cannot send IOUs');
    }
    if (config.mode === 'challenge' && config.challengeStatus !== 'ended') {
      throw new Error('Poker challenge must be ended before sending IOUs');
    }
    if (
      config.mode === 'challenge' &&
      body?.challengeHandNumber === undefined &&
      body?.settlementAmount === undefined
    ) {
      throw new Error('Poker challenge IOUs require challengeHandNumber and settlementAmount');
    }
  }

  const participants = new Set([
    parties.debtorEmail.trim().toLowerCase(),
    parties.creditorEmail.trim().toLowerCase(),
  ]);
  if (!participants.has(viewerEmail)) {
    throw new Error('You are not a party to this wager handoff');
  }
}

function logHandoffRejection(details: {
  tableId: string;
  sessionId: string;
  viewerEmail: string;
  debtorEmailPresent: boolean;
  creditorEmailPresent: boolean;
  rejectionReason: string;
  tableState?: GameState | null;
}): void {
  const parties = details.tableState ? resolveGameEndParties(details.tableState) : null;
  // eslint-disable-next-line no-console
  console.info('[SXM][iou-handoff] rejected', {
    tableId: details.tableId,
    gameId: details.sessionId,
    viewerEmail: details.viewerEmail,
    debtorPlayerId: parties?.loserId ?? null,
    creditorPlayerId: parties?.winnerId ?? null,
    debtorEmailPresent: details.debtorEmailPresent,
    creditorEmailPresent: details.creditorEmailPresent,
    rejectionReason: details.rejectionReason,
  });
}

function rememberDuplicate(
  store: Map<string, StoredHandoff>,
  payload: IouCreatePayload,
  error: string,
): IouHandoffCreateResult {
  const stored: StoredHandoff = {
    iouId: '',
    status: 'pending',
    message: error,
    submittedAt: new Date().toISOString(),
  };
  store.set(payload.nonce, stored);
  return {
    ok: true,
    iouId: stored.iouId,
    status: stored.status,
    message: 'This IOU handoff was already submitted.',
    alreadySubmitted: true,
  };
}
