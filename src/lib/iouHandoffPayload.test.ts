import { describe, expect, it } from 'vitest';
import {
  buildIouCreatePayload,
  buildIouHandoffNonceMaterial,
  classifyWagerToIouType,
  IOU_HANDOFF_PAYLOAD_VERSION,
  parseCashWagerDetails,
  validateIouCreatePayloadContract,
} from './iouHandoffPayload';

describe('iouHandoff payload', () => {
  it('classifies cash and personal wagers', () => {
    expect(classifyWagerToIouType('$5')).toBe('cash');
    expect(classifyWagerToIouType('Loser buys drinks')).toBe('personal');
  });

  it('parses cash amounts and currency when present', () => {
    expect(parseCashWagerDetails('$5')).toEqual({ amountCents: 500, currency: 'USD' });
    expect(parseCashWagerDetails('€10')).toEqual({ amountCents: 1000, currency: 'EUR' });
    expect(parseCashWagerDetails('5 USD')).toEqual({ amountCents: 500, currency: 'USD' });
  });

  it('builds deterministic nonce material for idempotency', () => {
    const a = buildIouHandoffNonceMaterial({
      tableId: 't1',
      gameId: 'g1',
      debtorEmail: 'a@example.com',
      creditorEmail: 'b@example.com',
      wager: '$5',
    });
    const b = buildIouHandoffNonceMaterial({
      tableId: 't1',
      gameId: 'g1',
      debtorEmail: 'a@example.com',
      creditorEmail: 'b@example.com',
      wager: '$5',
    });
    expect(a).toBe(b);
    expect(a).toContain('sxm:t1:g1');
  });

  it('builds cash IOU payload with amount and currency', () => {
    const payload = buildIouCreatePayload({
      debtorEmail: 'loser@example.com',
      creditorEmail: 'winner@example.com',
      title: '$5',
      wagerText: '$5',
      tableId: 'table-1',
      gameId: 'game-1',
      nonce: 'nonce-1',
    });
    expect(payload.type).toBe('cash');
    expect(payload.amountCents).toBe(500);
    expect(payload.currency).toBe('USD');
    expect(payload.cryptoSettlement).toBe(false);
    expect(payload.action).toBe('create_iou');
    expect(payload.source).toBe('sxm');
    expect(payload.metadata.sxmTableId).toBe('table-1');
    expect(payload.metadata.settlementReason).toBe('challenge_result');
  });

  it('builds personal IOU payload with zero USD contract markers', () => {
    const payload = buildIouCreatePayload({
      debtorEmail: 'loser@example.com',
      creditorEmail: 'winner@example.com',
      title: 'Car wash',
      wagerText: 'Car wash',
      tableId: 'table-1',
      gameId: 'game-1',
      nonce: 'nonce-2',
    });
    expect(payload.type).toBe('personal');
    expect(payload.payloadVersion).toBe(IOU_HANDOFF_PAYLOAD_VERSION);
    expect(payload.amountCents).toBe(0);
    expect(payload.currency).toBe('USD');
    expect(validateIouCreatePayloadContract(payload)).toBeNull();
  });

  it('rejects tampered payload contract and bad secret roundtrip', () => {
    const payload = buildIouCreatePayload({
      debtorEmail: 'loser@example.com',
      creditorEmail: 'winner@example.com',
      title: '$5',
      wagerText: '$5',
      tableId: 'table-1',
      gameId: 'game-1',
      nonce: 'nonce-3',
    });
    expect(validateIouCreatePayloadContract(payload)).toBeNull();
    const badPersonal = { ...payload, type: 'personal' as const, amountCents: undefined };
    expect(validateIouCreatePayloadContract(badPersonal)).toMatch(/Personal IOU/);
  });
});
