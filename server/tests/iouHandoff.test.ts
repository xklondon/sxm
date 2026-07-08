import { createDecipheriv, createHash } from 'node:crypto';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { buildServerIouCreatePayload } from '../src/lib/iouHandoffPayload.js';
import {
  deriveIouHandoffKey,
  encryptIouHandoff,
  sendIouCreateHandoff,
} from '../src/lib/iouHandoffCrypto.js';
import { validateIouCreatePayloadContract } from '../../src/lib/iouHandoffPayload.js';
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
    expect(validateIouCreatePayloadContract(payload)).toBeNull();
    const token = encryptIouHandoff(payload, TEST_SECRET);
    expect(token.split('.')).toHaveLength(3);
    const decoded = decryptHandoff(token, TEST_SECRET) as typeof payload;
    expect(decoded.debtorEmail).toBe('debtor@example.com');
    expect(decoded.nonce).toBe(payload.nonce);
    expect(decoded.payloadVersion).toBe(1);
  });

  it('bad secret fails decrypt (invalid/tampered contract)', () => {
    const payload = buildServerIouCreatePayload({
      debtorEmail: 'a@example.com',
      creditorEmail: 'b@example.com',
      title: 'Dinner',
      wagerText: 'Dinner',
      tableId: 't1',
      gameId: 'g1',
    });
    const token = encryptIouHandoff(payload, TEST_SECRET);
    expect(() => decryptHandoff(token, 'wrong-secret')).toThrow();
  });

  it('personal dinner IOU validates and round-trips encrypted', () => {
    const payload = buildServerIouCreatePayload({
      debtorEmail: 'loser@example.com',
      creditorEmail: 'winner@example.com',
      title: 'Dinner',
      wagerText: 'Dinner',
      tableId: 't1',
      gameId: 'g1',
    });
    expect(payload.type).toBe('personal');
    expect(payload.amountCents).toBe(0);
    expect(payload.currency).toBe('USD');
    expect(validateIouCreatePayloadContract(payload)).toBeNull();
    const decoded = decryptHandoff(encryptIouHandoff(payload, TEST_SECRET), TEST_SECRET) as typeof payload;
    expect(decoded.amountCents).toBe(0);
    expect(decoded.currency).toBe('USD');
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

  it('posts contract body { source, handoff } to integration create URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        iouId: 'iou-1',
        status: 'pending',
        message: 'IOU created and sent.',
      }),
    });
    const payload = buildServerIouCreatePayload({
      source: 'sxm',
      debtorEmail: 'debtor@example.com',
      creditorEmail: 'creditor@example.com',
      title: 'Dinner',
      wagerText: 'Dinner',
      tableId: 't1',
      gameId: 'g1',
    });
    expect(payload.type).toBe('personal');
    expect(payload.amountCents).toBe(0);
    expect(payload.currency).toBe('USD');
    expect(payload.payloadVersion).toBe(1);
    expect(payload.action).toBe('create_iou');
    expect(payload.cryptoSettlement).toBe(false);

    await sendIouCreateHandoff(payload, {
      source: 'sxm',
      secret: TEST_SECRET,
      createUrl: 'https://iou-wallet.com/api/integrations/handoff/create',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://iou-wallet.com/api/integrations/handoff/create');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      source: 'sxm',
      handoff: expect.stringMatching(/^[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+$/),
    });
    expect(Object.keys(body)).toEqual(['source', 'handoff']);
  });

  it('returns IOU Wallet message field when ok:false without string error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ ok: false, message: 'Unknown integration source' }),
    });
    const payload = buildServerIouCreatePayload({
      debtorEmail: 'a@example.com',
      creditorEmail: 'b@example.com',
      title: 'Dinner',
      wagerText: 'Dinner',
      tableId: 't1',
      gameId: 'g1',
    });
    const result = await sendIouCreateHandoff(payload, {
      source: 'sxm',
      secret: TEST_SECRET,
      createUrl: 'https://iou-wallet.com/api/integrations/handoff/create',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Unknown integration source');
    }
  });

  it('returns HTTP status when IOU body has no error message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ ok: false }),
    });
    const payload = buildServerIouCreatePayload({
      debtorEmail: 'a@example.com',
      creditorEmail: 'b@example.com',
      title: 'Dinner',
      wagerText: 'Dinner',
      tableId: 't1',
      gameId: 'g1',
    });
    const result = await sendIouCreateHandoff(payload, {
      source: 'sxm',
      secret: TEST_SECRET,
      createUrl: 'https://iou-wallet.com/api/integrations/handoff/create',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('IOU Wallet rejected the handoff (HTTP 401).');
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

  it('poker challenge IOU deduplicates by table + hand + parties + amount', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        iouId: 'poker-iou-1',
        status: 'pending',
        message: 'IOU created and sent.',
      }),
    });

    const body = {
      tableId: 't-poker',
      sessionId: 't-poker-poker-challenge-h3',
      wagerDescription: '$100 challenge',
      debtorEmail: 'loser@example.com',
      creditorEmail: 'winner@example.com',
      gameType: 'texas-holdem',
      challengeHandNumber: 3,
      settlementAmount: 25,
    };

    const svc = service();
    const first = await svc.createFromRequest('loser@example.com', body);
    expect(first.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const retry = await svc.createFromRequest('loser@example.com', body);
    expect(retry.alreadySubmitted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('failed poker IOU submission is not cached; retry after success is idempotent', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ ok: false, error: 'upstream offline' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          iouId: 'poker-iou-2',
          status: 'pending',
          message: 'IOU created and sent.',
        }),
      });

    const body = {
      tableId: 't-poker-2',
      sessionId: 't-poker-2-poker-challenge-h1',
      wagerDescription: '$50 challenge',
      debtorEmail: 'l1@example.com',
      creditorEmail: 'w@example.com',
      gameType: 'texas-holdem',
      challengeHandNumber: 1,
      settlementAmount: 12.5,
    };

    const svc = service();
    await expect(svc.createFromRequest('l1@example.com', body)).rejects.toThrow(/upstream offline/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const success = await svc.createFromRequest('l1@example.com', body);
    expect(success.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const retry = await svc.createFromRequest('l1@example.com', body);
    expect(retry.alreadySubmitted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('partial poker IOU batch failure does not mark unrelated losers as submitted', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          iouId: 'iou-a',
          status: 'pending',
          message: 'IOU created and sent.',
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ ok: false, error: 'upstream offline' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          iouId: 'iou-b',
          status: 'pending',
          message: 'IOU created and sent.',
        }),
      });

    const svc = service();
    const firstBody = {
      tableId: 't-batch',
      sessionId: 't-batch-poker-challenge-h2',
      wagerDescription: '$100',
      debtorEmail: 'l1@example.com',
      creditorEmail: 'w@example.com',
      gameType: 'texas-holdem',
      challengeHandNumber: 2,
      settlementAmount: 25,
    };
    const secondBody = {
      ...firstBody,
      debtorEmail: 'l2@example.com',
    };

    await svc.createFromRequest('l1@example.com', firstBody);
    await expect(svc.createFromRequest('l2@example.com', secondBody)).rejects.toThrow(/upstream offline/i);

    const retryFirst = await svc.createFromRequest('l1@example.com', firstBody);
    expect(retryFirst.alreadySubmitted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const retrySecond = await svc.createFromRequest('l2@example.com', secondBody);
    expect(retrySecond.ok).toBe(true);
    expect(retrySecond.iouId).toBe('iou-b');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejects practice poker IOU when table state is present', async () => {
    const practiceState = {
      session: { id: 't-practice', gameType: 'texas-holdem', playerIds: ['p1'] },
      tableMeta: {
        pokerConfig: { mode: 'practice' },
      },
    } as Parameters<IouHandoffService['createFromRequest']>[2];

    await expect(
      service().createFromRequest(
        'l@example.com',
        {
          tableId: 't-practice',
          sessionId: 't-practice-poker-challenge-h0',
          wagerDescription: '$5',
          debtorEmail: 'l@example.com',
          creditorEmail: 'w@example.com',
          gameType: 'texas-holdem',
          challengeHandNumber: 0,
          settlementAmount: 5,
        },
        practiceState,
      ),
    ).rejects.toThrow(/practice poker/i);
  });
});
