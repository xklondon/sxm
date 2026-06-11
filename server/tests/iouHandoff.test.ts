import { createDecipheriv, createHash } from 'node:crypto';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { buildServerIouCreatePayload } from '../src/lib/iouHandoffPayload.js';
import {
  deriveIouHandoffKey,
  encryptIouHandoff,
  sendIouCreateHandoff,
} from '../src/lib/iouHandoffCrypto.js';
import { IouHandoffService } from '../src/iouHandoff/service.js';

const TEST_SECRET = 'test-partner-secret';

function decryptHandoff(token: string, secret: string): unknown {
  const [ivPart, cipherPart, tagPart] = token.split('.');
  const key = deriveIouHandoffKey(secret);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(cipherPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plain);
}

describe('iouHandoffCrypto', () => {
  it('derives stable 32-byte key via sha256 for plain secrets', () => {
    const key = deriveIouHandoffKey(TEST_SECRET);
    expect(key.length).toBe(32);
    expect(key.equals(createHash('sha256').update(TEST_SECRET, 'utf8').digest())).toBe(true);
  });

  it('encrypts payload in iv.ciphertext.tag compact format', () => {
    const payload = buildServerIouCreatePayload({
      debtorEmail: 'debtor@example.com',
      creditorEmail: 'creditor@example.com',
      title: '$5',
      wagerText: '$5',
      tableId: 't1',
      gameId: 'g1',
    });
    const token = encryptIouHandoff(payload, TEST_SECRET);
    expect(token.split('.')).toHaveLength(3);
    const decoded = decryptHandoff(token, TEST_SECRET) as typeof payload;
    expect(decoded.debtorEmail).toBe('debtor@example.com');
    expect(decoded.nonce).toBe(payload.nonce);
  });
});

describe('sendIouCreateHandoff', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns clean error when IOU is offline', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const payload = buildServerIouCreatePayload({
      debtorEmail: 'a@example.com',
      creditorEmail: 'b@example.com',
      title: '$5',
      wagerText: '$5',
      tableId: 't1',
      gameId: 'g1',
    });
    const result = await sendIouCreateHandoff(payload, {
      source: 'sxm',
      secret: TEST_SECRET,
      createUrl: 'http://localhost:6969/api/integrations/handoff/create',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('unavailable');
    }
  });
});

describe('IouHandoffService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function service() {
    return new IouHandoffService({
      enabled: true,
      source: 'sxm',
      secret: TEST_SECRET,
      createUrl: 'http://localhost:6969/api/integrations/handoff/create',
    });
  }

  it('rejects missing debtor/creditor emails', async () => {
    await expect(
      service().createFromRequest('viewer@example.com', {
        tableId: 't1',
        sessionId: 'g1',
        wagerDescription: '$5',
        debtorEmail: '',
        creditorEmail: 'b@example.com',
      }),
    ).rejects.toThrow(/required/i);
  });

  it('rejects identical debtor and creditor emails', async () => {
    await expect(
      service().createFromRequest('a@example.com', {
        tableId: 't1',
        sessionId: 'g1',
        wagerDescription: '$5',
        debtorEmail: 'a@example.com',
        creditorEmail: 'a@example.com',
      }),
    ).rejects.toThrow(/different people/i);
  });

  it('creates cash IOU and deduplicates repeated nonce', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        iouId: 'iou-1',
        status: 'pending',
        message: 'IOU created and sent.',
      }),
    });

    const body = {
      tableId: 't1',
      sessionId: 'g1',
      wagerDescription: '$5',
      debtorEmail: 'debtor@example.com',
      creditorEmail: 'creditor@example.com',
    };

    const svc = service();
    const first = await svc.createFromRequest('debtor@example.com', body);
    expect(first.ok).toBe(true);
    expect(first.iouId).toBe('iou-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await svc.createFromRequest('debtor@example.com', body);
    expect(second.alreadySubmitted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
