import { detectIouTypeFromWager, IOU_GAME_MESSAGE, type IouWalletType } from '../utils/iouWalletHandoff';

export const IOU_HANDOFF_ACTION = 'create_iou' as const;
export const IOU_HANDOFF_SOURCE_DEFAULT = 'sxm';
export const IOU_CREATE_MESSAGE =
  'Created from SXM Casino after a completed challenge.';

export interface IouHandoffMetadata {
  sxmTableId: string;
  sxmGameId: string;
  gameType: string;
  settlementReason: 'challenge_result';
}

export interface IouCreatePayload {
  source: string;
  action: typeof IOU_HANDOFF_ACTION;
  debtorEmail: string;
  creditorEmail: string;
  debtorName?: string;
  creditorName?: string;
  title: string;
  message: string;
  type: IouWalletType;
  cryptoSettlement: false;
  amountCents?: number;
  currency?: string;
  createdAt: string;
  expiresAt: string;
  nonce: string;
  metadata: IouHandoffMetadata;
}

export interface IouCreatePayloadInput {
  source?: string;
  debtorEmail: string;
  creditorEmail: string;
  debtorName?: string;
  creditorName?: string;
  title: string;
  wagerText: string;
  tableId: string;
  gameId: string;
  gameType?: string;
  message?: string;
  createdAt?: string;
  expiresAt?: string;
  nonce: string;
}

export interface ParsedCashWager {
  amountCents?: number;
  currency?: string;
}

export interface IouHandoffCreateRequestBody {
  tableId: string;
  sessionId: string;
  wagerDescription: string;
  debtorEmail: string;
  creditorEmail: string;
  debtorName?: string;
  creditorName?: string;
  gameType?: string;
  title?: string;
  message?: string;
}

export interface IouHandoffCreateSuccessResponse {
  ok: true;
  iouId: string;
  status: string;
  message: string;
  alreadySubmitted?: boolean;
  openUrl?: string;
}

export interface IouHandoffCreateErrorResponse {
  ok: false;
  error: string;
}

export type IouHandoffCreateResponse =
  | IouHandoffCreateSuccessResponse
  | IouHandoffCreateErrorResponse;

/** Classify wager text as cash or personal IOU type. */
export function classifyWagerToIouType(wagerText: string): IouWalletType {
  return detectIouTypeFromWager(wagerText);
}

/** Parse money amounts from common wager strings ($5, €10, 5 USD). */
export function parseCashWagerDetails(wagerText: string): ParsedCashWager {
  const trimmed = wagerText.trim();
  if (!trimmed) {
    return {};
  }

  const symbolMatch = trimmed.match(/^([$€£¥])\s*(\d+(?:\.\d{1,2})?)$/);
  if (symbolMatch) {
    const amountCents = Math.round(Number(symbolMatch[2]) * 100);
    const currency = currencyFromSymbol(symbolMatch[1]);
    return currency ? { amountCents, currency } : { amountCents };
  }

  const codeMatch = trimmed.match(/^(\d+(?:\.\d{1,2})?)\s*(USD|EUR|GBP|CAD|AUD)$/i);
  if (codeMatch) {
    return {
      amountCents: Math.round(Number(codeMatch[1]) * 100),
      currency: codeMatch[2].toUpperCase(),
    };
  }

  const prefixMatch = trimmed.match(/^(\$|€|£|¥)\s*(\d+(?:\.\d{1,2})?)\b/);
  if (prefixMatch) {
    const amountCents = Math.round(Number(prefixMatch[2]) * 100);
    const currency = currencyFromSymbol(prefixMatch[1]);
    return currency ? { amountCents, currency } : { amountCents };
  }

  return {};
}

function currencyFromSymbol(symbol: string): string | undefined {
  switch (symbol) {
    case '$':
      return 'USD';
    case '€':
      return 'EUR';
    case '£':
      return 'GBP';
    case '¥':
      return 'JPY';
    default:
      return undefined;
  }
}

/** Canonical idempotency material — hashed server-side into the IOU nonce. */
export function buildIouHandoffNonceMaterial(parts: {
  tableId: string;
  gameId: string;
  debtorEmail: string;
  creditorEmail: string;
  wager: string;
}): string {
  return [
    'sxm',
    parts.tableId.trim(),
    parts.gameId.trim(),
    parts.debtorEmail.trim().toLowerCase(),
    parts.creditorEmail.trim().toLowerCase(),
    parts.wager.trim(),
  ].join(':');
}

/** Build the plaintext IOU create payload (encrypted server-side before POST). */
export function buildIouCreatePayload(input: IouCreatePayloadInput): IouCreatePayload {
  const debtorEmail = input.debtorEmail.trim().toLowerCase();
  const creditorEmail = input.creditorEmail.trim().toLowerCase();
  const wagerText = input.wagerText.trim();
  const type = classifyWagerToIouType(wagerText);
  const createdAt = input.createdAt ?? new Date().toISOString();
  const expiresAt =
    input.expiresAt ??
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const payload: IouCreatePayload = {
    source: input.source?.trim() || IOU_HANDOFF_SOURCE_DEFAULT,
    action: IOU_HANDOFF_ACTION,
    debtorEmail,
    creditorEmail,
    title: input.title.trim() || wagerText || 'Blackjack wager',
    message: input.message?.trim() || IOU_CREATE_MESSAGE,
    type,
    cryptoSettlement: false,
    createdAt,
    expiresAt,
    nonce: input.nonce,
    metadata: {
      sxmTableId: input.tableId,
      sxmGameId: input.gameId,
      gameType: input.gameType?.trim() || 'blackjack',
      settlementReason: 'challenge_result',
    },
  };

  if (input.debtorName?.trim()) {
    payload.debtorName = input.debtorName.trim();
  }
  if (input.creditorName?.trim()) {
    payload.creditorName = input.creditorName.trim();
  }

  if (type === 'cash') {
    const cash = parseCashWagerDetails(wagerText);
    if (cash.amountCents !== undefined) {
      payload.amountCents = cash.amountCents;
    }
    if (cash.currency) {
      payload.currency = cash.currency;
    }
  }

  return payload;
}

/** Client-side idempotency key for a completed table session. */
export function iouHandoffStorageKey(tableId: string, sessionId: string): string {
  return `sxm-iou-handoff:${tableId}:${sessionId}`;
}

export { IOU_GAME_MESSAGE };
