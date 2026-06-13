import type { GameState } from '../../types';
import type { BoxStakeEntry } from '../../types/table';
import { getBlackjackProtocolPhase } from '../blackjack/protocol';
import { parseBlackjackHandKey } from '../blackjack/handKeys';
import { log } from '../../utils/logger';
import {
  canControllerCallBox,
  getAssignedSlotForPerson,
  getCallerPersonIdForBox,
  getNativeAssignedPersonForSlot,
  isSinglePlayerTable,
} from './playerAssignment';

/** Decision owner for hit/stand/split/double/insurance on a box. */
export function getBoxDecisionOwner(
  state: GameState,
  boxPlayerId: string,
): string | null {
  return getCallerPersonIdForBox(state, boxPlayerId);
}

export interface ActionableHandForView {
  handKey: string;
  boxId: string;
}

export type ViewerActionBlockReason =
  | 'not-player-phase'
  | 'even-money'
  | 'no-active-hand'
  | 'hand-not-acting'
  | 'no-viewer'
  | 'not-decision-owner'
  | 'wrong-hero-box';

export interface ViewerActionPermission {
  canAct: boolean;
  actionable: ActionableHandForView | null;
  activeHandKey: string | null;
  activeBoxId: string | null;
  decisionOwnerId: string | null;
  blockReason: ViewerActionBlockReason | null;
  waitMessage: string | null;
}

function slotForBox(state: GameState, boxPlayerId: string) {
  return state.tableMeta.boxSlots.find((s) => s.playerId === boxPlayerId);
}

function callerDisplayName(state: GameState, personId: string | null): string {
  if (!personId) {
    return 'caller';
  }
  const person = state.players[personId];
  return person?.controllerName?.trim() || person?.displayName || 'caller';
}

/** Waiting text when the viewer may not act on the active hand. */
export function formatDecisionOwnerWaitMessage(
  state: GameState,
  boxPlayerId: string,
): string {
  const slotNum = state.session.boxSlotNumbers?.[boxPlayerId];
  const ownerId = getBoxDecisionOwner(state, boxPlayerId);
  const ownerName = callerDisplayName(state, ownerId);
  return slotNum
    ? `Box ${slotNum} — waiting for ${ownerName} to call.`
    : `Waiting for ${ownerName} to call.`;
}

/**
 * First bettor on a free (non-native) box owns decisions for that betting round.
 * Native assignment always wins over stake order.
 */
export function assignTemporaryBoxOwnerOnFirstBet(
  state: GameState,
  boxPlayerId: string,
  bettorPersonId: string,
  existing?: BoxStakeEntry,
): string {
  if (existing?.callerPersonId) {
    return existing.callerPersonId;
  }
  const slot = slotForBox(state, boxPlayerId);
  if (slot?.nativeAssignedPersonId) {
    log.info('temporaryBoxOwnerSkippedNative', {
      boxPlayerId,
      nativeOwner: slot.nativeAssignedPersonId,
      bettorPersonId,
    });
    return slot.nativeAssignedPersonId;
  }
  const slotNum = state.session.boxSlotNumbers?.[boxPlayerId];
  if (slotNum) {
    const native = getNativeAssignedPersonForSlot(state, slotNum);
    if (native) {
      return native;
    }
  }
  log.info('temporaryBoxOwnerAssigned', { boxPlayerId, bettorPersonId });
  return bettorPersonId;
}

/**
 * Canonical "can this viewer act on the server-authoritative active hand?"
 * Shared by Full Table, Card View (all layouts), swipe, and buttons.
 */
export function getViewerCanActOnActiveHand(
  state: GameState,
  viewerPersonId: string | null,
): ActionableHandForView | null {
  const round = state.blackjack;
  if (!round || getBlackjackProtocolPhase(state) !== 'player') {
    return null;
  }
  if (round.evenMoneyOfferHandKey) {
    return null;
  }
  const handKey = round.activeHandKey;
  if (!handKey) {
    return null;
  }
  const hand = round.playerHands[handKey];
  if (!hand || hand.actionStatus !== 'acting') {
    return null;
  }
  if (!viewerPersonId) {
    return null;
  }
  const { playerId: boxId } = parseBlackjackHandKey(handKey);
  const ownerId = getBoxDecisionOwner(state, boxId);
  if (ownerId !== viewerPersonId || !canControllerCallBox(state, boxId, viewerPersonId)) {
    if (import.meta.env?.DEV) {
      log.info('viewerCannotActOnActiveHand', {
        viewerPersonId,
        boxId,
        decisionOwnerId: ownerId,
        activeHandKey: handKey,
        reason: ownerId !== viewerPersonId ? 'not-decision-owner' : 'canControllerCallBox-false',
      });
    }
    return null;
  }
  if (import.meta.env?.DEV) {
    log.info('viewerCanActOnActiveHand', {
      viewerPersonId,
      boxId,
      activeHandKey: handKey,
      decisionOwnerId: ownerId,
    });
  }
  return { handKey, boxId };
}

/** @deprecated Prefer getViewerCanActOnActiveHand — kept for existing imports. */
export function getActionableHandForView(
  state: GameState,
  personId: string | null,
  _onlineMode?: boolean,
): ActionableHandForView | null {
  void _onlineMode;
  return getViewerCanActOnActiveHand(state, personId);
}

export interface ResolveViewerActionPermissionOptions {
  /** Card View only: hero box must match the active hand box to enable controls. */
  cardViewHeroBoxId?: string | null;
}

/** Canonical player-turn action gate — shared by Hit/Stay, swipe, and command copy. */
export function canActCurrentHand(
  state: GameState,
  viewerPersonId: string | null,
  options: ResolveViewerActionPermissionOptions = {},
): boolean {
  return resolveViewerActionPermission(state, viewerPersonId, options).canAct;
}

/**
 * Single permission route for action buttons, swipe, and waiting copy.
 * Full Table omits cardViewHeroBoxId; Card View passes the hero box id.
 */
export function resolveViewerActionPermission(
  state: GameState,
  viewerPersonId: string | null,
  options: ResolveViewerActionPermissionOptions = {},
): ViewerActionPermission {
  const round = state.blackjack;
  const activeHandKey =
    round && getBlackjackProtocolPhase(state) === 'player' ? round.activeHandKey ?? null : null;
  const activeBoxId = activeHandKey
    ? parseBlackjackHandKey(activeHandKey).playerId
    : null;
  const decisionOwnerId = activeBoxId ? getBoxDecisionOwner(state, activeBoxId) : null;

  const base = {
    actionable: null as ActionableHandForView | null,
    activeHandKey,
    activeBoxId,
    decisionOwnerId,
  };

  if (!round || getBlackjackProtocolPhase(state) !== 'player') {
    return { ...base, canAct: false, blockReason: 'not-player-phase', waitMessage: null };
  }
  if (round.evenMoneyOfferHandKey) {
    return { ...base, canAct: false, blockReason: 'even-money', waitMessage: null };
  }
  if (!activeHandKey) {
    return { ...base, canAct: false, blockReason: 'no-active-hand', waitMessage: null };
  }
  const hand = round.playerHands[activeHandKey];
  if (!hand || hand.actionStatus !== 'acting') {
    return { ...base, canAct: false, blockReason: 'hand-not-acting', waitMessage: null };
  }
  if (!viewerPersonId) {
    return { ...base, canAct: false, blockReason: 'no-viewer', waitMessage: null };
  }
  if (!activeBoxId) {
    return { ...base, canAct: false, blockReason: 'no-active-hand', waitMessage: null };
  }

  const actionable = getViewerCanActOnActiveHand(state, viewerPersonId);
  if (!actionable) {
    return {
      ...base,
      canAct: false,
      blockReason: 'not-decision-owner',
      waitMessage: formatDecisionOwnerWaitMessage(state, activeBoxId),
    };
  }

  const heroBoxId = options.cardViewHeroBoxId;
  if (heroBoxId !== undefined && heroBoxId !== null && heroBoxId !== actionable.boxId) {
    const slotNum = state.session.boxSlotNumbers?.[actionable.boxId];
    return {
      ...base,
      actionable,
      canAct: false,
      blockReason: 'wrong-hero-box',
      waitMessage: slotNum ? `Waiting for Box ${slotNum}` : 'Waiting for turn…',
    };
  }

  return {
    ...base,
    actionable,
    canAct: true,
    blockReason: null,
    waitMessage: null,
  };
}

export interface CanonicalBoxAssignment {
  personId: string;
  nativeSlot: number | null;
}

/** Native box index (1-based) for each seated person — does not drift with bets. */
export function getCanonicalBoxAssignment(state: GameState): CanonicalBoxAssignment[] {
  return state.tableMeta.playerOrder?.map((personId) => ({
    personId,
    nativeSlot: getAssignedSlotForPerson(state, personId),
  })) ?? [];
}

export function logNativeBoxAssignments(state: GameState, context: string): void {
  if (!import.meta.env?.DEV) {
    return;
  }
  for (const { personId, nativeSlot } of getCanonicalBoxAssignment(state)) {
    log.info('nativeBoxAssignment', { context, personId, nativeSlot });
  }
}

/** Solo tables: viewer may call every staked box; multiplayer uses decision owner only. */
export function getViewerCanActOnBox(
  state: GameState,
  boxPlayerId: string,
  viewerPersonId: string | null,
): boolean {
  if (!viewerPersonId) {
    return false;
  }
  if (isSinglePlayerTable(state)) {
    return true;
  }
  return getBoxDecisionOwner(state, boxPlayerId) === viewerPersonId;
}
