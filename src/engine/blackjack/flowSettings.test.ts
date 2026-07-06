import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BLACKJACK_FLOW_SETTINGS,
  dealDelayMsForPreset,
  getNextCardDelay,
  normalizeFlowSettings,
  syncDealTimingFromPreset,
} from './flowSettings';

describe('flowSettings deal speed', () => {
  it('defaults to natural dealing with 3 second deal speed', () => {
    expect(DEFAULT_BLACKJACK_FLOW_SETTINGS.initialDealMode).toBe('natural');
    expect(DEFAULT_BLACKJACK_FLOW_SETTINGS.dealSpeedPreset).toBe('normal');
    expect(dealDelayMsForPreset('normal')).toBe(3000);
    expect(DEFAULT_BLACKJACK_FLOW_SETTINGS.naturalDealDelayMs).toBe(3000);
  });

  it('syncDealTimingFromPreset derives all pacing fields from deal speed', () => {
    const synced = syncDealTimingFromPreset({
      ...DEFAULT_BLACKJACK_FLOW_SETTINGS,
      dealSpeedPreset: 'medium',
    });
    expect(synced.autoDealDelayMs).toBe(2000);
    expect(synced.naturalDealDelayMs).toBe(2000);
    expect(synced.bankDrawMinDelayMs).toBe(2000);
    expect(getNextCardDelay({ blackjackFlowSettings: synced })).toBe(2000);
  });

  it('normalizeFlowSettings applies timing sync', () => {
    const settings = normalizeFlowSettings({ dealSpeedPreset: 'slow' });
    expect(settings.naturalDealDelayMs).toBe(5000);
  });
});
