/**
 * Protocol boundary — single import surface for view-layer action eligibility.
 * Views must not call engine legality helpers directly; use this module instead.
 */
import type { GameState } from '../types';
import type { BlackjackSettings } from '../engine/blackjack/settings';
import {
  canDoubleBlackjackForState,
  canHitBlackjack,
  canSplitBlackjackForState,
  canStandBlackjack,
} from '../engine/blackjack';

export {
  allowsBettingActions,
  canShowPlayerDecisionControls,
  getActionableHandForView,
  getBlackjackRoundPhase,
  getInsuranceActionsForController,
  getPrimaryInsuranceActionForController,
  getMyPendingInsurancePlayerIds,
  showEvenMoneyControls,
  showInsuranceControls,
  showPlayerActionControls,
  resolveViewerActionPermission,
  getViewerCanActOnActiveHand,
  formatDecisionOwnerWaitMessage,
  type ActionableHandForView,
  type InsuranceActionView,
  type ViewerActionPermission,
} from './blackjackViewPhase';

export { canActCurrentHand } from '../engine/session/boxDecisionOwnership';

export interface PlayerHandActionOptions {
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
  showDouble: boolean;
  showSplit: boolean;
}

/** Engine legality for one hand — call only after `resolveViewerActionPermission.canAct`. */
export function resolvePlayerHandActionOptions(
  state: GameState,
  handKey: string,
  settings: Pick<BlackjackSettings, 'allowDoubleDown' | 'allowSplit'>,
  hasDeck: boolean,
): PlayerHandActionOptions {
  const round = state.blackjack;
  if (!round) {
    return {
      canHit: false,
      canStand: false,
      canDouble: false,
      canSplit: false,
      showDouble: false,
      showSplit: false,
    };
  }
  return {
    canHit: canHitBlackjack(round, handKey),
    canStand: canStandBlackjack(round, handKey),
    canDouble: hasDeck && canDoubleBlackjackForState(state, handKey),
    canSplit: canSplitBlackjackForState(state, handKey),
    showDouble: settings.allowDoubleDown,
    showSplit: settings.allowSplit && hasDeck,
  };
}

/** View files that must route action legality through this module. */
export const ACTION_CONTRACT_VIEW_FILES = [
  'src/components/BlackjackPanel.tsx',
  'src/components/BlackjackCardView.tsx',
] as const;

/** Engine imports views must not use directly for UI legality. */
export const FORBIDDEN_DIRECT_ENGINE_ACTION_IMPORTS = [
  'canHitBlackjack',
  'canStandBlackjack',
  'canDoubleBlackjackForState',
  'canSplitBlackjackForState',
] as const;
