import type { IouCreatePayload } from '../../../src/lib/iouHandoffPayload.js';

/** Safe host-only extract for logs — never includes path/query secrets. */
export function iouHandoffCreateUrlHost(createUrl: string): string {
  try {
    return new URL(createUrl).host;
  } catch {
    return 'invalid-url';
  }
}

/** First 8 chars of deterministic nonce — enough for correlation, not reversible. */
export function iouHandoffNoncePrefix(nonce: string): string {
  return nonce.slice(0, 8);
}

/** IV prefix only — never log full ciphertext or auth tag. */
export function iouHandoffTokenIvPrefix(handoff: string): string {
  const iv = handoff.split('.')[0] ?? '';
  return iv ? `${iv.slice(0, 6)}…` : 'invalid';
}

export interface IouHandoffPayloadDiagnostics {
  source: string;
  createUrlHost: string;
  debtorEmailPresent: boolean;
  creditorEmailPresent: boolean;
  action: string;
  type: string;
  amountCentsPresent: boolean;
  currency: string | null;
  cryptoSettlement: boolean;
  noncePrefix: string;
  handoffIvPrefix: string;
}

export function buildIouHandoffPayloadDiagnostics(
  payload: IouCreatePayload,
  createUrl: string,
  handoff: string,
): IouHandoffPayloadDiagnostics {
  return {
    source: payload.source,
    createUrlHost: iouHandoffCreateUrlHost(createUrl),
    debtorEmailPresent: Boolean(payload.debtorEmail?.trim()),
    creditorEmailPresent: Boolean(payload.creditorEmail?.trim()),
    action: payload.action,
    type: payload.type,
    amountCentsPresent: payload.amountCents !== undefined,
    currency: payload.currency ?? null,
    cryptoSettlement: payload.cryptoSettlement,
    noncePrefix: iouHandoffNoncePrefix(payload.nonce),
    handoffIvPrefix: iouHandoffTokenIvPrefix(handoff),
  };
}

/** Extract a user-safe error string from IOU Wallet JSON bodies. */
export function parseIouWalletRemoteError(
  record: Record<string, unknown>,
  httpStatus: number,
): string {
  const errorField = record.error;
  if (typeof errorField === 'string' && errorField.trim()) {
    return errorField.trim();
  }
  if (errorField && typeof errorField === 'object') {
    const nested = errorField as Record<string, unknown>;
    if (typeof nested.message === 'string' && nested.message.trim()) {
      return nested.message.trim();
    }
  }
  if (typeof record.message === 'string' && record.message.trim() && record.ok !== true) {
    return record.message.trim();
  }
  if (typeof record.details === 'string' && record.details.trim()) {
    return record.details.trim();
  }
  if (httpStatus >= 400) {
    return `IOU Wallet rejected the handoff (HTTP ${httpStatus}).`;
  }
  return 'IOU Wallet rejected the handoff.';
}
