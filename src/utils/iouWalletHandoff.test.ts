import { describe, expect, it } from 'vitest';

import {
  buildIouWalletNewUrl,
  detectIouTypeFromWager,
  IOU_GAME_MESSAGE,
} from './iouWalletHandoff';

describe('iouWalletHandoff', () => {
  it('detects cash wager as type=cash', () => {
    expect(detectIouTypeFromWager('€20')).toBe('cash');
    expect(detectIouTypeFromWager('$5 buy-in')).toBe('cash');
  });

  it('detects non-cash wager as type=personal', () => {
    expect(detectIouTypeFromWager('Loser buys drinks')).toBe('personal');
    expect(detectIouTypeFromWager('car wash')).toBe('personal');
  });

  it('builds URL with required params and excludes due date/rates', () => {
    const url = buildIouWalletNewUrl({
      counterpartyEmail: 'friend@example.com',
      title: 'Dinner',
      message: IOU_GAME_MESSAGE,
      type: 'personal',
      cryptoSettlement: false,
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://iou-wallet.com/new');
    expect(parsed.searchParams.get('counterpartyEmail')).toBe('friend@example.com');
    expect(parsed.searchParams.get('title')).toBe('Dinner');
    expect(parsed.searchParams.get('message')).toBe(IOU_GAME_MESSAGE);
    expect(parsed.searchParams.get('type')).toBe('personal');
    expect(parsed.searchParams.get('cryptoSettlement')).toBe('false');
    expect(parsed.searchParams.has('dueDate')).toBe(false);
    expect(parsed.searchParams.has('rate')).toBe(false);
    expect(parsed.searchParams.has('interestRate')).toBe(false);
  });
});
