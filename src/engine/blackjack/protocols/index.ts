import type { BlackjackSettings } from '../settings';
import type { BlackjackProtocol } from './types';
import { LAS_VEGAS_PROTOCOL } from './lasVegasProtocol';
import { EUROPEAN_SHOE_PROTOCOL } from './europeanShoeProtocol';
import { CLASSIC_HOME_PROTOCOL } from './classicHomeProtocol';

export type {
  AidRecommendedAction,
  AidProfile,
  BlackjackProtocol,
  DealerRules,
  DealingRules,
  DoubleRules,
  HandResolutionRules,
  InsuranceRules,
  PayoutRules,
  PhaseActionRules,
  ProtocolDisplayRule,
  ProtocolPlayerAction,
  ShoeConfig,
  SplitRules,
  SurrenderRules,
  VariantExtensions,
} from './types';

export {
  canDoubleUnderProtocol,
  canSplitUnderProtocol,
  canHitUnderProtocol,
  canStandUnderProtocol,
  getAllowedActionsForHand,
  getBlackjackPayout,
  getInsuranceRules,
  getDealerPeekPolicy,
  getDealerDrawDecision,
  isBetValidUnderProtocol,
  formatMinBetMultipleMessage,
  shouldOfferEvenMoney,
  shouldPayNaturalImmediately,
  buildActiveRulesHandContext,
  isHandEligibleForInsuranceOffer,
  getInsuranceEligiblePlayerIds,
  allInsuranceDecisionsResolved,
  shouldOfferInsuranceUnderProtocol,
} from './activeRules';
export { LAS_VEGAS_PROTOCOL } from './lasVegasProtocol';
export { EUROPEAN_SHOE_PROTOCOL } from './europeanShoeProtocol';
export { CLASSIC_HOME_PROTOCOL } from './classicHomeProtocol';

/** Default preset when no protocol id is selected. */
export const ACTIVE_BLACKJACK_PROTOCOL = LAS_VEGAS_PROTOCOL;

export const BLACKJACK_PROTOCOL_PRESETS: readonly BlackjackProtocol[] = [
  LAS_VEGAS_PROTOCOL,
  EUROPEAN_SHOE_PROTOCOL,
  CLASSIC_HOME_PROTOCOL,
] as const;

export const DEFAULT_BLACKJACK_PROTOCOL_ID = LAS_VEGAS_PROTOCOL.protocolId;

const PROTOCOL_BY_ID = new Map<string, BlackjackProtocol>(
  BLACKJACK_PROTOCOL_PRESETS.map((p) => [p.protocolId, p]),
);

export function getBlackjackProtocolById(protocolId: string): BlackjackProtocol | undefined {
  return PROTOCOL_BY_ID.get(protocolId);
}

export function getBlackjackProtocolOrDefault(protocolId?: string | null): BlackjackProtocol {
  if (protocolId) {
    const found = PROTOCOL_BY_ID.get(protocolId);
    if (found) {
      return found;
    }
  }
  return LAS_VEGAS_PROTOCOL;
}

/** @deprecated use getBlackjackProtocolOrDefault(state.blackjackProtocolId) */
export function getActiveBlackjackProtocol(): BlackjackProtocol {
  return LAS_VEGAS_PROTOCOL;
}

export function listBlackjackProtocolPresets(): BlackjackProtocol[] {
  return [...BLACKJACK_PROTOCOL_PRESETS];
}

/** Map declarative protocol → runtime engine settings (backward compatible). */
export function protocolToBlackjackSettings(
  protocol: BlackjackProtocol = LAS_VEGAS_PROTOCOL,
): BlackjackSettings {
  return {
    numberOfDecks: protocol.shoe.deckCount,
    blackjackPayout: protocol.payouts.blackjackMultiplier,
    dealerStandsOnSoft17: protocol.dealer.standsOnSoft17,
    doubleAllowedTotals: protocol.double.allowedHardTotals,
    allowDoubleDown: protocol.double.allowed,
    allowSplit: protocol.split.allowed,
    maxSplits: protocol.split.maxSplitsPerRound,
    allowDoubleAfterSplit: protocol.split.doubleAfterSplit,
    allowInsurance: protocol.insurance.offered,
    holeCardDealtLast: protocol.dealingRules.holeCardDealtLast,
    startingPhase: 'betting',
    minBet: protocol.defaultMinBet,
    maxBet: protocol.defaultMaxBet,
  };
}

export function isSettingsMatchingProtocol(
  settings: BlackjackSettings,
  protocol: BlackjackProtocol = LAS_VEGAS_PROTOCOL,
): boolean {
  const expected = protocolToBlackjackSettings(protocol);
  return (
    settings.numberOfDecks === expected.numberOfDecks &&
    settings.blackjackPayout === expected.blackjackPayout &&
    settings.dealerStandsOnSoft17 === expected.dealerStandsOnSoft17 &&
    JSON.stringify(settings.doubleAllowedTotals) === JSON.stringify(expected.doubleAllowedTotals) &&
    settings.allowDoubleDown === expected.allowDoubleDown &&
    settings.allowSplit === expected.allowSplit &&
    settings.maxSplits === expected.maxSplits &&
    settings.allowDoubleAfterSplit === expected.allowDoubleAfterSplit &&
    settings.allowInsurance === expected.allowInsurance
  );
}

export function getProtocolDisplayRules(
  protocol: BlackjackProtocol = LAS_VEGAS_PROTOCOL,
): BlackjackProtocol['displayRules'] {
  return protocol.displayRules;
}

export function applyProtocolToStateFields(protocol: BlackjackProtocol): {
  blackjackProtocolId: string;
  blackjackSettings: BlackjackSettings;
} {
  return {
    blackjackProtocolId: protocol.protocolId,
    blackjackSettings: protocolToBlackjackSettings(protocol),
  };
}
