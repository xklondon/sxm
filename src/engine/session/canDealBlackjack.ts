import type { GameState } from '../../types';
import { log } from '../../utils/logger';
import { getBlackjackProtocolPhase } from '../blackjack/protocol';
import {
  evaluateBlackjackDealEngine,
  getEligibleDealBoxes,
  type CanDealBlackjackOptions,
  type CanDealBlackjackReason,
  type CanDealBlackjackResult,
} from '../blackjack/dealEligibility';
import { resolvePlayableBoxes } from './playableBoxes';

export type { CanDealBlackjackOptions, CanDealBlackjackReason, CanDealBlackjackResult };

export const DEAL_CARDS_HOST_ONLY_MESSAGE = 'Only the table host can deal cards.';

const HOST_REASON_MESSAGES: Record<'owner_not_hydrated' | 'viewer_unknown' | 'not_table_host', string> = {
  owner_not_hydrated: 'Table owner not loaded yet.',
  viewer_unknown: 'Cannot identify viewer — only the table host can deal cards.',
  not_table_host: DEAL_CARDS_HOST_ONLY_MESSAGE,
};

function hostFail(
  reason: 'owner_not_hydrated' | 'viewer_unknown' | 'not_table_host',
): CanDealBlackjackResult {
  return {
    allowed: false,
    reason,
    message: HOST_REASON_MESSAGES[reason],
  };
}

/**
 * Canonical deal authority — table host + betting-phase engine readiness + eligible stakes.
 * Box commander / native assignment never gates deal; only stake eligibility does.
 */
export function canDealBlackjack(
  state: GameState,
  viewerPersonId: string | null | undefined,
  options?: CanDealBlackjackOptions,
): CanDealBlackjackResult {
  const ownerPersonId = state.tableMeta.ownerPersonId ?? null;
  if (!ownerPersonId) {
    return hostFail('owner_not_hydrated');
  }
  if (!viewerPersonId) {
    return hostFail('viewer_unknown');
  }
  if (viewerPersonId !== ownerPersonId) {
    return hostFail('not_table_host');
  }
  return evaluateBlackjackDealEngine(state, options);
}

function playableAuditLabels(state: GameState): string[] {
  const eligible = new Set(getEligibleDealBoxes(state));
  return resolvePlayableBoxes(state)
    .filter((box) => eligible.has(box.boxId))
    .map((box) => {
      const slot = state.session.boxSlotNumbers?.[box.boxId];
      return slot ? `box${slot}` : box.boxId;
    });
}

/** Logs `[DEAL AUDIT]` on every deal click / guard. */
export function logDealAudit(
  state: GameState,
  viewerPersonId: string | null | undefined,
  options?: CanDealBlackjackOptions & { source?: string },
): CanDealBlackjackResult {
  const result = canDealBlackjack(state, viewerPersonId, options);
  const payload = {
    viewer: viewerPersonId ?? null,
    owner: state.tableMeta.ownerPersonId ?? null,
    phase: getBlackjackProtocolPhase(state),
    playable: playableAuditLabels(state),
    allowed: result.allowed,
    reason: result.allowed ? undefined : result.reason,
    source: options?.source,
  };
  log.info('[DEAL AUDIT]', payload);
  return result;
}

export { evaluateBlackjackDealEngine } from '../blackjack/dealEligibility';
