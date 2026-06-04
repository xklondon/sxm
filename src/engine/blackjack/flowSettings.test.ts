import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BLACKJACK_FLOW_SETTINGS,
  dealDelayMsForPreset,
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
      dealSpeedPreset: 'fast',
    });
    expect(synced.autoDealDelayMs).toBe(1000);
    expect(synced.naturalDealDelayMs).toBe(1000);
    expect(synced.bankDrawMinDelayMs).toBe(1000);
    expect(synced.bankDrawMaxDelayMs).toBe(1000);
    expect(synced.bankStandPauseMs).toBe(500);
    expect(synced.bankingDisplayMs).toBe(500);
  });

  it('normalizeFlowSettings applies timing sync', () => {
    const settings = normalizeFlowSettings({ dealSpeedPreset: 'slow' });
    expect(settings.naturalDealDelayMs).toBe(5000);
  });
});
