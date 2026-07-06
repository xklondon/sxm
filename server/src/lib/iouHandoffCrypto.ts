import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import type { IouCreatePayload } from '../../../src/lib/iouHandoffPayload.js';
import {
  buildIouHandoffPayloadDiagnostics,
  parseIouWalletRemoteError,
} from './iouHandoffDiagnostics.js';

export {
  buildIouHandoffPayloadDiagnostics,
  iouHandoffCreateUrlHost,
  iouHandoffNoncePrefix,
  parseIouWalletRemoteError,
} from './iouHandoffDiagnostics.js';

function base64url(buf: Buffer): string {
  return buf.toString('base64url');
}

/** Derive a 32-byte AES key from the partner shared secret. */
export function deriveIouHandoffKey(secret: string): Buffer {
  const trimmed = secret.trim();
  if (!trimmed) {
    throw new Error('IOU handoff secret is not configured');
  }

  try {
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // fall through to sha256
  }

  try {
    const decoded = Buffer.from(trimmed, 'base64url');
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // fall through to sha256
  }

  return createHash('sha256').update(trimmed, 'utf8').digest();
}

/** AES-256-GCM encrypt → base64url(iv).base64url(ciphertext).base64url(authTag). */
export function encryptIouHandoff(payload: IouCreatePayload, secret: string): string {
  const key = deriveIouHandoffKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(payload);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${base64url(iv)}.${base64url(ciphertext)}.${base64url(authTag)}`;
}

export interface IouHandoffRemoteConfig {
  source: string;
  secret: string;
  createUrl: string;
}

export interface IouHandoffRemoteSuccess {
  ok: true;
  iouId: string;
  status: string;
  message: string;
  openUrl?: string;
}

export interface IouHandoffRemoteFailure {
  ok: false;
  error: string;
  duplicate?: boolean;
}

export type IouHandoffRemoteResponse = IouHandoffRemoteSuccess | IouHandoffRemoteFailure;

/** POST encrypted handoff to IOU Wallet integration endpoint. */
export async function sendIouCreateHandoff(
  payload: IouCreatePayload,
  config: IouHandoffRemoteConfig,
): Promise<IouHandoffRemoteResponse> {
  const handoff = encryptIouHandoff(payload, config.secret);
  const diagnostics = buildIouHandoffPayloadDiagnostics(payload, config.createUrl, handoff);
  // eslint-disable-next-line no-console
  console.info('[SXM][iou-handoff] remote attempt', diagnostics);

  let response: Response;
  try {
    response = await fetch(config.createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: config.source,
        handoff,
      }),
    });
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[SXM][iou-handoff] remote unreachable', {
      createUrlHost: diagnostics.createUrlHost,
      source: config.source,
    });
    return { ok: false, error: 'IOU Wallet is unavailable. Try again later.' };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[SXM][iou-handoff] remote invalid json', {
      httpStatus: response.status,
      createUrlHost: diagnostics.createUrlHost,
    });
    return {
      ok: false,
      error: response.ok
        ? 'IOU Wallet returned an invalid response.'
        : `IOU Wallet request failed (HTTP ${response.status}).`,
    };
  }

  if (!body || typeof body !== 'object') {
    // eslint-disable-next-line no-console
    console.warn('[SXM][iou-handoff] remote invalid body', {
      httpStatus: response.status,
      createUrlHost: diagnostics.createUrlHost,
    });
    return { ok: false, error: 'IOU Wallet returned an invalid response.' };
  }

  const record = body as Record<string, unknown>;
  if (record.ok === true) {
    // eslint-disable-next-line no-console
    console.info('[SXM][iou-handoff] remote accepted', {
      httpStatus: response.status,
      createUrlHost: diagnostics.createUrlHost,
      iouId: typeof record.iouId === 'string' ? record.iouId : undefined,
      status: typeof record.status === 'string' ? record.status : undefined,
    });
    return {
      ok: true,
      iouId: String(record.iouId ?? ''),
      status: String(record.status ?? 'pending'),
      message: String(record.message ?? 'IOU created and sent.'),
      openUrl: typeof record.openUrl === 'string' ? record.openUrl : undefined,
    };
  }

  const error = parseIouWalletRemoteError(record, response.status);
  const duplicate =
    /duplicate|replay|already/i.test(error) ||
    /duplicate|replay|already/i.test(String(record.code ?? ''));

  // eslint-disable-next-line no-console
  console.warn('[SXM][iou-handoff] remote rejected', {
    httpStatus: response.status,
    createUrlHost: diagnostics.createUrlHost,
    source: config.source,
    error,
    duplicate,
    noncePrefix: diagnostics.noncePrefix,
  });

  return { ok: false, error, duplicate };
}
