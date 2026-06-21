import type { GameState } from '../types';
import type { BlackjackRound } from '../types/blackjack';
import type { BlackjackProtocolPhase } from '../engine/blackjack/protocol';
import { getBlackjackProtocolPhase } from '../engine/blackjack/protocol';
import { isInitialDealRoundComplete } from '../engine/blackjack/initialDealGuards';
import { isPacedCardReveal } from '../engine/blackjack/dealing/dealingModes';
import { isActionRevealReady } from '../engine/blackjack/dealing/cardRevealDisplay';
import { parseBlackjackHandKey } from '../engine/blackjack/handKeys';
import { getInsuranceEligibleBoxIds } from '../engine/blackjack/protocols/activeRules';
import { isInsuranceBoxDecisionResolved } from '../engine/blackjack/insurance';
import { getBlackjackProtocolForState } from '../engine/blackjack/protocolState';
import { getInsuranceOfferForBox, canPersonDecideInsuranceForBox } from '../engine/blackjack/insurance';
import {
  canControllerCallBox,
  isSeatedPersonAtTable,
  resolveViewerPersonId,
  type ViewerIdentityHints,
} from '../engine/session';
import {
  getViewerCanActOnActiveHand,
  type ActionableHandForView,
} from '../engine/session/boxDecisionOwnership';
import { isTableGameActive } from '../engine/session/tableGameEnd';

export function isBettingPhase(phase: BlackjackProtocolPhase): boolean {
  return phase === 'betting';
}

/**
 * Canonical round phase — the single source every view/selector must read.
 * Online and offline derive phase from the same engine state, so this never
 * branches on transport.
 */
export function getBlackjackRoundPhase(state: GameState): BlackjackProtocolPhase {
  return getBlackjackProtocolPhase(state);
}

/**
 * Canonical "betting is open" predicate shared by the flow hook and all views.
 * No view may decide betting eligibility independently.
 */
export function allowsBettingActions(state: GameState): boolean {
  return (
    isTableGameActive(state) &&
    !state.tableMeta.bettingLocked &&
    getBlackjackRoundPhase(state) === 'betting'
  );
}

export function isInsurancePhase(phase: BlackjackProtocolPhase): boolean {
  return phase === 'insurance';
}

export function isPlayerTurnPhase(phase: BlackjackProtocolPhase): boolean {
  return phase === 'player';
}

export function isBankPhase(phase: BlackjackProtocolPhase): boolean {
  return phase === 'bank' || phase === 'banking';
}

export function isDealingPhase(phase: BlackjackProtocolPhase): boolean {
  return phase === 'dealing';
}

export function isRoundCompletePhase(phase: BlackjackProtocolPhase): boolean {
  return phase === 'round-complete';
}

/** Chip tray + bet circles footer — betting phase only. */
export function showBettingFooter(phase: BlackjackProtocolPhase, gameEnded: boolean): boolean {
  return !gameEnded && isBettingPhase(phase);
}

/** Hit / stay / double / split — active player turn, not even-money. */
export function showPlayerActionControls(
  phase: BlackjackProtocolPhase,
  round: BlackjackRound | null | undefined,
): boolean {
  if (!round || !isPlayerTurnPhase(phase)) {
    return false;
  }
  if (round.evenMoneyOfferHandKey) {
    return false;
  }
  return Boolean(round.activeHandKey);
}

/**
 * Player decision buttons (HIT/STAY/2×/SPLIT/AID) — only after initial deal is
 * complete in engine and UI reveal has caught up (display phase + reveal flag).
 */
export function canShowPlayerDecisionControls(
  state: GameState,
  displayPhase: BlackjackProtocolPhase,
  options: { cardRevealComplete: boolean; activeHandRevealComplete?: boolean },
): boolean {
  const round = state.blackjack;
  const enginePhase = getBlackjackProtocolPhase(state);
  const activeHandReady =
    options.activeHandRevealComplete ?? options.cardRevealComplete;
  const effectivePhase =
    enginePhase === 'player' && activeHandReady ? 'player' : displayPhase;

  if (!showPlayerActionControls(effectivePhase, round)) {
    return false;
  }
  const pacedReveal = isPacedCardReveal(state.blackjackFlowSettings.initialDealMode);
  const revealReady = isActionRevealReady(pacedReveal, {
    cardRevealComplete: options.cardRevealComplete,
    activeHandRevealComplete: options.activeHandRevealComplete ?? false,
  });
  if (!revealReady || isDealingPhase(effectivePhase)) {
    return false;
  }
  if (round?.status === 'initial-deal') {
    return false;
  }
  if (round && !isInitialDealRoundComplete(state.session, round)) {
    return false;
  }
  return true;
}

export function showEvenMoneyControls(
  phase: BlackjackProtocolPhase,
  round: BlackjackRound | null | undefined,
): boolean {
  return isPlayerTurnPhase(phase) && Boolean(round?.evenMoneyOfferHandKey);
}

export function showInsuranceControls(
  phase: BlackjackProtocolPhase,
  round: BlackjackRound | null | undefined,
): boolean {
  return isInsurancePhase(phase) && Boolean(round?.insuranceOfferPending);
}

export function primaryPhaseMessage(
  gameEnded: boolean,
  gameOverMessage: string,
  centerStatus: string,
): string {
  return gameEnded ? gameOverMessage : centerStatus;
}

/** Dealer up-cards + rule strip — hidden during betting and when game ended. */
export function showDealerHeader(
  phase: BlackjackProtocolPhase,
  gameEnded: boolean,
): boolean {
  if (gameEnded) {
    return false;
  }
  return !isBettingPhase(phase) && !isRoundCompletePhase(phase);
}

/** Large center betting box — betting phase only. */
export function showBettingMainStage(
  phase: BlackjackProtocolPhase,
  gameEnded: boolean,
): boolean {
  return showBettingFooter(phase, gameEnded);
}

/** Stitched player cards — never during betting; requires dealt cards. */
export function showStitchedPlayerCards(
  phase: BlackjackProtocolPhase,
  gameEnded: boolean,
  cardCount: number,
): boolean {
  return showHeroPlayerCards(phase, gameEnded, cardCount);
}

/** Hero area shows active player hand cards (authoritative count), not dealer/bank placeholders. */
export function showHeroPlayerCards(
  phase: BlackjackProtocolPhase,
  gameEnded: boolean,
  logicalCardCount: number,
): boolean {
  if (gameEnded || isBettingPhase(phase) || logicalCardCount <= 0) {
    return false;
  }
  if (
    isPlayerTurnPhase(phase) ||
    isInsurancePhase(phase) ||
    isDealingPhase(phase) ||
    isBankPhase(phase) ||
    isRoundCompletePhase(phase)
  ) {
    return true;
  }
  return false;
}

/** Box id owning the server-authoritative active hand during player turns. */
export function getActiveTurnBoxId(
  state: GameState,
  phase: BlackjackProtocolPhase,
): string | null {
  if (!isPlayerTurnPhase(phase)) {
    return null;
  }
  const handKey = state.blackjack?.activeHandKey;
  if (!handKey) {
    return null;
  }
  return parseBlackjackHandKey(handKey).playerId;
}

/** Side hit/stand controls — player turn only, not insurance/even-money. */
export function showStitchedActionControls(
  state: GameState,
  displayPhase: BlackjackProtocolPhase,
  options: { cardRevealComplete: boolean; activeHandRevealComplete?: boolean },
): boolean {
  return canShowPlayerDecisionControls(state, displayPhase, options);
}

export type { ActionableHandForView } from '../engine/session/boxDecisionOwnership';

/**
 * Canonical "can this viewer act right now?" selector shared by Full Table and
 * Card View. Returns the hand the viewer may act on, or null. It keys strictly
 * off `state.blackjack.activeHandKey` (server-authoritative online), so action
 * controls can never be enabled for a non-active or non-owned hand. A hand that
 * has auto-stood/stood/busted/blackjacked is never actionable, so an 18+
 * auto-stand hand never exposes HIT/STAY.
 *
 * `onlineMode` is accepted for call-site clarity; the selector itself is mode
 * agnostic because online actions carry no render-time handKey and the server
 * resolves against this same activeHandKey.
 */
export function getActionableHandForView(
  state: GameState,
  personId: string | null,
  onlineMode: boolean,
): ActionableHandForView | null {
  void onlineMode;
  return getViewerCanActOnActiveHand(state, personId);
}

export {
  formatDecisionOwnerWaitMessage,
  getViewerCanActOnActiveHand,
  resolveViewerActionPermission,
  type ViewerActionPermission,
} from '../engine/session/boxDecisionOwnership';

export type CardViewBoxStatus =
  | 'betting'
  | 'playing'
  | 'stood'
  | 'bust'
  | 'blackjack'
  | 'resolved'
  | 'waiting';

/** Large stitched-card / betting hero — active turn in play, selected seat in betting. */
export function getCardViewHeroBoxId(
  phase: BlackjackProtocolPhase,
  activeBoxId: string | null,
  selectedSeatId: string | null | undefined,
  focusBoxId: string | null | undefined,
): string | null {
  if (isBettingPhase(phase)) {
    return selectedSeatId ?? focusBoxId ?? null;
  }
  if (activeBoxId) {
    return activeBoxId;
  }
  return selectedSeatId ?? focusBoxId ?? null;
}

/** Hand key for the hero box — active turn hand during play; primary hand otherwise. */
export function getCardViewHeroHandKey(
  phase: BlackjackProtocolPhase,
  round: BlackjackRound | null | undefined,
  heroBoxId: string | null,
  heroHandKeyOverride?: string | null,
): string | null {
  if (!heroBoxId) {
    return null;
  }
  if (heroHandKeyOverride && isPlayerTurnPhase(phase)) {
    return heroHandKeyOverride;
  }
  if (isPlayerTurnPhase(phase) && round?.activeHandKey) {
    return round.activeHandKey;
  }
  return `${heroBoxId}:0`;
}

/** Hand key for a box tile — matches active split hand when that box is on turn. */
export function getCardViewHandKeyForBox(
  phase: BlackjackProtocolPhase,
  round: BlackjackRound | null | undefined,
  boxId: string,
): string {
  if (isPlayerTurnPhase(phase) && round?.activeHandKey) {
    const { playerId } = parseBlackjackHandKey(round.activeHandKey);
    if (playerId === boxId) {
      return round.activeHandKey;
    }
  }
  return `${boxId}:0`;
}

export function isCardViewMiniBox(boxId: string, heroBoxId: string | null): boolean {
  return heroBoxId !== null && boxId !== heroBoxId;
}

export function getCardViewBoxStatus(
  phase: BlackjackProtocolPhase,
  gameEnded: boolean,
  round: BlackjackRound | null | undefined,
  handKey: string,
  openStake: number,
  isActiveTurnBox: boolean,
): CardViewBoxStatus {
  if (gameEnded) {
    return 'resolved';
  }
  if (isBettingPhase(phase)) {
    return 'betting';
  }
  const hand = round?.playerHands[handKey];
  if (!hand) {
    return openStake > 0 ? 'betting' : 'waiting';
  }
  if (hand.bustSettled || hand.actionStatus === 'busted') {
    return 'bust';
  }
  if (hand.naturalSettled || hand.actionStatus === 'done') {
    return 'resolved';
  }
  if (hand.actionStatus === 'blackjack') {
    return 'blackjack';
  }
  if (hand.actionStatus === 'stood') {
    return 'stood';
  }
  if (hand.actionStatus === 'acting') {
    return isActiveTurnBox ? 'playing' : 'waiting';
  }
  return 'waiting';
}

export function formatCardViewBoxStatus(status: CardViewBoxStatus): string {
  switch (status) {
    case 'betting':
      return 'Betting';
    case 'playing':
      return 'Playing';
    case 'stood':
      return 'Stood';
    case 'bust':
      return 'Bust';
    case 'blackjack':
      return 'Blackjack';
    case 'resolved':
      return 'Resolved';
    default:
      return 'Waiting';
  }
}

/** Playing-phase layout slot class names — order is documented in CARD_VIEW_PLAYING_SLOT_ORDER. */
export const CARD_VIEW_PLAYING_LAYOUT = {
  handMeta: 'bj-phone-view__hand-meta',
  heroCards: 'bj-phone-view__cards--stitched',
  actionBar: 'bj-phone-view__action-bar',
  actionBarPrimary: 'bj-phone-view__action-bar-primary',
  actionBarSecondary: 'bj-phone-view__action-bar-secondary',
  miniBoxes: 'bj-phone-view__mini-row',
  actionBtnTappable: 'bj-phone-view__action-btn--tappable',
  totalBadgeHero: 'bj-phone-view__total--hero',
  heroStage: 'bj-phone-view__hero-stage',
  sideActionStand: 'bj-phone-view__side-action--stand',
  sideActionHit: 'bj-phone-view__side-action--hit',
  actionBarBtn: 'bj-phone-view__action-bar-btn',
  actionBarBtnStand: 'bj-phone-view__side-action--stand',
  actionBarBtnHit: 'bj-phone-view__side-action--hit',
} as const;

export const CARD_VIEW_PLAYING_SLOT_ORDER = [
  CARD_VIEW_PLAYING_LAYOUT.handMeta,
  CARD_VIEW_PLAYING_LAYOUT.heroCards,
  CARD_VIEW_PLAYING_LAYOUT.actionBar,
  CARD_VIEW_PLAYING_LAYOUT.miniBoxes,
] as const;

export function heroActionsRenderBeforeCards(
  order: readonly string[] = CARD_VIEW_PLAYING_SLOT_ORDER,
): boolean {
  const metaIdx = order.indexOf(CARD_VIEW_PLAYING_LAYOUT.handMeta);
  const cardsIdx = order.indexOf(CARD_VIEW_PLAYING_LAYOUT.heroCards);
  return metaIdx >= 0 && cardsIdx >= 0 && metaIdx < cardsIdx;
}

export function miniBoxesRenderAfterHeroCards(
  order: readonly string[] = CARD_VIEW_PLAYING_SLOT_ORDER,
): boolean {
  const miniIdx = order.indexOf(CARD_VIEW_PLAYING_LAYOUT.miniBoxes);
  const cardsIdx = order.indexOf(CARD_VIEW_PLAYING_LAYOUT.heroCards);
  return miniIdx >= 0 && cardsIdx >= 0 && miniIdx > cardsIdx;
}

export function hitStandUseActionBarButtonClass(): boolean {
  return CARD_VIEW_PLAYING_LAYOUT.actionBarBtn === 'bj-phone-view__action-bar-btn';
}

export function actionButtonsUseTappableClass(): boolean {
  return CARD_VIEW_PLAYING_LAYOUT.actionBtnTappable === 'bj-phone-view__action-btn--tappable';
}

/** Eligible boxes still needing an explicit insurance accept/decline from the caller. */
export function getPendingInsurancePlayerIds(
  state: GameState,
  round: BlackjackRound,
): string[] {
  const protocol = getBlackjackProtocolForState(state);
  const eligible = getInsuranceEligibleBoxIds(state.session, round, protocol);
  return eligible.filter(
    (boxId) => !isInsuranceBoxDecisionResolved(state, round, protocol, boxId),
  );
}

export function getMyPendingInsurancePlayerIds(
  state: GameState,
  round: BlackjackRound,
  viewerPersonId: string | null,
): string[] {
  if (!viewerPersonId || !isSeatedPersonAtTable(state, viewerPersonId)) {
    return [];
  }
  return getPendingInsurancePlayerIds(state, round).filter((boxId) =>
    canPersonDecideInsuranceForBox(state, boxId, viewerPersonId),
  );
}

export interface InsuranceActionView {
  personId: string;
  boxIds: string[];
  maxBet: number;
  canAfford: boolean;
  slotNumbers: number[];
  /** @deprecated First box id — prefer boxIds */
  playerId: string;
  /** @deprecated First slot — prefer slotNumbers */
  slotNumber: number | undefined;
}

/** One insurance action per pending eligible box the viewer may decide (slot order). */
export function getInsuranceActionsForController(
  state: GameState,
  round: BlackjackRound,
  viewerPersonId: string | null,
): InsuranceActionView[] {
  if (!viewerPersonId) {
    return [];
  }
  const protocol = getBlackjackProtocolForState(state);
  const pendingBoxIds = getMyPendingInsurancePlayerIds(state, round, viewerPersonId);
  return pendingBoxIds.flatMap((boxId) => {
    const offer = getInsuranceOfferForBox(state, round, boxId, protocol);
    if (!offer) {
      return [];
    }
    const slotNumber = state.session.boxSlotNumbers?.[boxId];
    return [
      {
        personId: viewerPersonId,
        boxIds: [boxId],
        maxBet: offer.maxBet,
        canAfford: offer.canAfford,
        slotNumbers: typeof slotNumber === 'number' ? [slotNumber] : [],
        playerId: boxId,
        slotNumber,
      },
    ];
  });
}

/** Next insurance decision for this controller — first pending eligible box only. */
export function getPrimaryInsuranceActionForController(
  state: GameState,
  round: BlackjackRound,
  viewerPersonId: string | null,
): InsuranceActionView | null {
  return getInsuranceActionsForController(state, round, viewerPersonId)[0] ?? null;
}

export function canCallEvenMoneyForHand(
  state: GameState,
  handKey: string,
  viewerPersonId: string | null,
): boolean {
  const playerId = handKey.split(':')[0]!;
  return (
    viewerPersonId !== null &&
    canControllerCallBox(state, playerId, viewerPersonId)
  );
}

export function canCallBoxForPlayer(
  state: GameState,
  boxPlayerId: string,
  viewerPersonId: string | null,
): boolean {
  return (
    viewerPersonId !== null &&
    canControllerCallBox(state, boxPlayerId, viewerPersonId)
  );
}

export function resolveViewerPersonIdForActions(
  state: GameState,
  hints: ViewerIdentityHints,
): string | null {
  return resolveViewerPersonId(state, hints);
}
