import type { GameState } from '../../types';
import { log } from '../../utils/logger';
import { isVerboseDevLogging } from '../../utils/devFlags';
import {
  canStartCards,
  getCardsBlockReason,
  getBlackjackProtocolPhase,
} from '../blackjack/protocol';
import { getEligibleDealBoxes } from '../blackjack/dealEligibility';

export const DEAL_CARDS_HOST_ONLY_MESSAGE = 'Only the table host can deal cards.';

const VIEWER_UNKNOWN_MESSAGE = 'Cannot identify viewer — only the table host can deal cards.';
const OWNER_NOT_HYDRATED_MESSAGE = 'Table owner not loaded yet.';

/**
 * True when the current viewer is the table owner/host and may run deal controls.
 * Does not infer from bank role, box ownership, or table mode.
 */
export function canCurrentUserDealTable(
  state: GameState,
  viewerPersonId: string | null | undefined,
): boolean {
  const ownerPersonId = state.tableMeta.ownerPersonId;
  if (!ownerPersonId || !viewerPersonId) {
    if (isVerboseDevLogging()) {
      log.debug('dealTablePermission', {
        ownerPersonId: ownerPersonId ?? null,
        viewerPersonId: viewerPersonId ?? null,
        canDeal: false,
        reason: !ownerPersonId ? 'owner-not-hydrated' : 'viewer-unknown',
      });
    }
    return false;
  }
  const canDeal = viewerPersonId === ownerPersonId;
  if (isVerboseDevLogging()) {
    log.debug('dealTablePermission', {
      ownerPersonId,
      viewerPersonId,
      canDeal,
    });
  }
  return canDeal;
}

/**
 * Single rejection reason for deal-start — shared by UI, offline reducer, and server.
 * Returns null when the table host may press Deal Cards.
 */
export function getBlackjackDealBlockReason(
  state: GameState,
  viewerPersonId: string | null | undefined,
): string | null {
  const ownerPersonId = state.tableMeta.ownerPersonId ?? null;
  if (!ownerPersonId) {
    return OWNER_NOT_HYDRATED_MESSAGE;
  }
  if (!viewerPersonId) {
    return VIEWER_UNKNOWN_MESSAGE;
  }
  if (viewerPersonId !== ownerPersonId) {
    return DEAL_CARDS_HOST_ONLY_MESSAGE;
  }
  return getCardsBlockReason(state);
}

/** Canonical deal-start authority: table host + betting-phase engine readiness + eligible stakes. */
export function canStartBlackjackDeal(
  state: GameState,
  viewerPersonId: string | null | undefined,
): boolean {
  return getBlackjackDealBlockReason(state, viewerPersonId) === null;
}

/** Dev/test audit — logs every guard input when deal is blocked or allowed. */
export function logBlackjackDealPermissionAudit(
  state: GameState,
  viewerPersonId: string | null | undefined,
  extra?: { source?: string },
): void {
  const ownerPersonId = state.tableMeta.ownerPersonId ?? null;
  const blockReason = getBlackjackDealBlockReason(state, viewerPersonId);
  const payload = {
    source: extra?.source ?? 'deal-permission',
    viewerPersonId,
    ownerPersonId,
    phase: getBlackjackProtocolPhase(state),
    roundStatus: state.blackjack?.status ?? null,
    awaitingNextRound: state.tableMeta.awaitingNextRound ?? false,
    bettingLocked: state.tableMeta.bettingLocked ?? false,
    shoeStarted: state.tableMeta.shoeStarted ?? false,
    canCurrentUserDealTable: canCurrentUserDealTable(state, viewerPersonId),
    canStartCards: canStartCards(state),
    canStartBlackjackDeal: blockReason === null,
    eligibleDealBoxes: getEligibleDealBoxes(state),
    blockReason,
  };
  if (blockReason) {
    log.info('dealCardsBlocked', payload);
  } else if (isVerboseDevLogging()) {
    log.debug('dealCardsAllowed', payload);
  }
}
