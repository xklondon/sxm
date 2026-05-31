/**
 * Las Vegas-style Blackjack protocol reference — derived from declarative protocol.
 * Settings in `settings.ts` configure runtime variants within protocol bounds.
 */

import type { BlackjackSettings } from './settings';
import { DEFAULT_BLACKJACK_SETTINGS } from './settings';
import {
  LAS_VEGAS_PROTOCOL,
  getProtocolDisplayRules,
  isSettingsMatchingProtocol,
} from './protocols';

export const INSURANCE_PAYOUT_RATIO = LAS_VEGAS_PROTOCOL.insurance.payoutRatio;

/** Human-readable rule strings for audits and docs — built from protocol display rules. */
export const LAS_VEGAS_BLACKJACK_RULES = {
  blackjackPayout: `${LAS_VEGAS_PROTOCOL.payouts.blackjackLabel} (natural 21 with two cards)`,
  dealerStand: LAS_VEGAS_PROTOCOL.dealer.description,
  dealerSoft17: LAS_VEGAS_PROTOCOL.dealer.standsOnSoft17
    ? 'Dealer stands on soft 17 (S17)'
    : 'Dealer hits soft 17 (H17)',
  doubleDown: LAS_VEGAS_PROTOCOL.double.description,
  split: LAS_VEGAS_PROTOCOL.split.description,
  splitAces: 'Split hands marked fromSplit; double-after-split configurable',
  maxSplits: `Repeat splits up to shoe safety cap (${LAS_VEGAS_PROTOCOL.split.maxSplitsPerRound} per box)`,
  aces: 'Count as 1 or 11 (soft hands)',
  bust: LAS_VEGAS_PROTOCOL.payouts.bustLoses,
  push: LAS_VEGAS_PROTOCOL.payouts.pushPays,
  win: LAS_VEGAS_PROTOCOL.payouts.winPays,
  insurance: LAS_VEGAS_PROTOCOL.insurance.description,
  ledger: 'All chip movement via table ledger entries',
  displayRules: getProtocolDisplayRules(LAS_VEGAS_PROTOCOL),
} as const;

export function isLasVegasDefaultSettings(settings: BlackjackSettings): boolean {
  return isSettingsMatchingProtocol(settings, LAS_VEGAS_PROTOCOL);
}

export function insuranceBetMax(mainBet: number): number {
  return Math.floor(mainBet / 2);
}

export function insuranceWinPayout(insuranceBet: number): number {
  return insuranceBet + insuranceBet * INSURANCE_PAYOUT_RATIO;
}

export interface RuleAuditResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export function runBlackjackRulesAudit(
  settings: BlackjackSettings = DEFAULT_BLACKJACK_SETTINGS,
): { passed: boolean; results: RuleAuditResult[] } {
  const results: RuleAuditResult[] = [];
  const protocol = LAS_VEGAS_PROTOCOL;

  results.push({
    name: 'Blackjack pays 3:2',
    passed: settings.blackjackPayout === protocol.payouts.blackjackMultiplier,
    detail: `blackjackPayout=${settings.blackjackPayout}`,
  });

  results.push({
    name: 'Dealer soft-17 rule is explicit',
    passed: typeof settings.dealerStandsOnSoft17 === 'boolean',
    detail: settings.dealerStandsOnSoft17 ? 'stand on soft 17' : 'hit soft 17',
  });

  results.push({
    name: 'Double down enabled (Vegas default)',
    passed: settings.allowDoubleDown === protocol.double.allowed,
  });

  results.push({
    name: 'Split enabled (Vegas default)',
    passed: settings.allowSplit === protocol.split.allowed,
  });

  results.push({
    name: 'Max splits configured',
    passed: settings.maxSplits >= 1 && settings.maxSplits <= 8,
    detail: `maxSplits=${settings.maxSplits}`,
  });

  results.push({
    name: 'Insurance rule explicit',
    passed: typeof settings.allowInsurance === 'boolean',
    detail: settings.allowInsurance ? 'offered' : 'disabled',
  });

  results.push({
    name: 'Deck count in range',
    passed:
      settings.numberOfDecks >= protocol.shoe.minDecks &&
      settings.numberOfDecks <= protocol.shoe.maxDecks,
    detail: `numberOfDecks=${settings.numberOfDecks}`,
  });

  const passed = results.every((r) => r.passed);
  return { passed, results };
}
