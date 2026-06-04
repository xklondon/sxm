import { describe, expect, it } from 'vitest';
import { shouldRunClientBankAutomation } from './useBlackjackTableFlow';

describe('client bank automation gate', () => {
  it('online tables never run client-side bank loops', () => {
    expect(
      shouldRunClientBankAutomation({
        hasOnlineDispatch: true,
        canDriveTableAutomation: true,
        bankDrawMode: 'auto',
        roundStatus: 'bank-turn',
      }),
    ).toBe(false);
  });

  it('passive offline viewers do not run client-side bank loops', () => {
    expect(
      shouldRunClientBankAutomation({
        hasOnlineDispatch: false,
        canDriveTableAutomation: false,
        bankDrawMode: 'auto',
        roundStatus: 'bank-turn',
      }),
    ).toBe(false);
    expect(
      shouldRunClientBankAutomation({
        hasOnlineDispatch: false,
        canDriveTableAutomation: false,
        bankDrawMode: 'auto',
        roundStatus: 'banking',
      }),
    ).toBe(false);
  });

  it('owner/controller offline driver runs auto bank during bank phases', () => {
    expect(
      shouldRunClientBankAutomation({
        hasOnlineDispatch: false,
        canDriveTableAutomation: true,
        bankDrawMode: 'auto',
        roundStatus: 'bank-turn',
      }),
    ).toBe(true);
    expect(
      shouldRunClientBankAutomation({
        hasOnlineDispatch: false,
        canDriveTableAutomation: true,
        bankDrawMode: 'auto',
        roundStatus: 'banking',
      }),
    ).toBe(true);
  });

  it('manual bank mode never runs auto loop', () => {
    expect(
      shouldRunClientBankAutomation({
        hasOnlineDispatch: false,
        canDriveTableAutomation: true,
        bankDrawMode: 'manual',
        roundStatus: 'bank-turn',
      }),
    ).toBe(false);
  });
});
