import type { GameState } from '../../types';
import { log } from '../../utils/logger';
import { isVerboseDevLogging } from '../../utils/devFlags';
import {
  canDealBlackjack,
  logDealAudit,
  DEAL_CARDS_HOST_ONLY_MESSAGE,
} from './canDealBlackjack';

export { DEAL_CARDS_HOST_ONLY_MESSAGE };

/**
 * True when the current viewer is the table owner/host and may run deal controls.
 * Host gate only — does not check stakes, shoe, or engine phase.
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

/** @deprecated Use canDealBlackjack().message */
export function getBlackjackDealBlockReason(
  state: GameState,
  viewerPersonId: string | null | undefined,
): string | null {
  return canDealBlackjack(state, viewerPersonId).message;
}

/** @deprecated Use canDealBlackjack().allowed */
export function canStartBlackjackDeal(
  state: GameState,
  viewerPersonId: string | null | undefined,
): boolean {
  return canDealBlackjack(state, viewerPersonId).allowed;
}

/** @deprecated Use logDealAudit */
export function logBlackjackDealPermissionAudit(
  state: GameState,
  viewerPersonId: string | null | undefined,
  extra?: { source?: string },
): void {
  logDealAudit(state, viewerPersonId, extra);
}

export { canDealBlackjack, logDealAudit, evaluateBlackjackDealEngine } from './canDealBlackjack';
