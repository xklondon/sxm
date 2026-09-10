import type { GameState } from '../../../src/types/index.js';
import type { TableActionType } from './actions.js';
import { getBlackjackProtocolPhase } from '../../../src/engine/blackjack/protocol.js';
import { parseBlackjackHandKey } from '../../../src/engine/blackjack/handKeys.js';
import {
  getCallerPersonIdForBox,
  getAssignedSlotForPerson,
  isSeatedPersonAtTable,
} from '../../../src/engine/session/playerAssignment.js';
import { hasPersonalLedgerEntryForTable } from '../../../src/engine/scoreLedger/scoreLedger.js';
import { getTableAdminSettings } from '../../../src/engine/table/adminControls.js';
import { canDealBlackjack } from '../../../src/engine/session/canDealBlackjack.js';
import { hasAnyStakes } from '../../../src/engine/blackjack/stakes.js';
import { isBankerReady } from '../../../src/engine/session/boxOps.js';
import { canControlZilchTurn } from '../../../src/engine/dice/zilch/zilchTurnAuthority.js';
import {
  getInsuranceDecisionPersonIdForBox,
  canPersonDecideInsuranceForBox,
  getPendingInsuranceBoxIdsForPerson,
} from '../../../src/engine/blackjack/insurance.js';
import {
  assertHoldemHostAction,
  assertHoldemPlayerGameplayAction,
  assertHoldemAllInAuthorized,
  assertUpdateHoldemBlindsAuthorized,
} from '../../../src/engine/holdem/holdemTurnAuthority.js';
import { assertEndHoldemChallengeAuthorized } from '../../../src/engine/holdem/challengeWinner.js';

export interface ActionContext {
  tableId: string;
  userId: string;
  personId: string;
  action: TableActionType;
  payload: Record<string, unknown>;
}

export function assertActionAuthorized(state: GameState, ctx: ActionContext): void {
  const phase = getBlackjackProtocolPhase(state);

  switch (ctx.action) {
    case 'placeBet':
    case 'retractChip':
    case 'clearBet':
      if (phase !== 'betting') {
        throw new Error('Betting is not open');
      }
      if (state.tableMeta.bettingLocked) {
        throw new Error('Betting is locked');
      }
      if (ctx.action === 'placeBet') {
        // Same positive-amount discipline as holdemBet/holdemRaise below — a
        // negative chip would silently shrink a box stake in the engine.
        const amount = Number(ctx.payload.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error('amount must be a positive number');
        }
      }
      assertBetPlacement(state, ctx);
      return;

    case 'assignBox':
      if (phase !== 'betting') {
        throw new Error('Box assignment only during betting');
      }
      return;

    case 'shuffleToStart':
      assertHostDealAction(state, ctx, { requireShoeNotStarted: true });
      return;

    case 'dealCards':
      assertHostDealAction(state, ctx, { requireShoeStarted: true });
      return;

    case 'hit':
    case 'stand':
    case 'double':
    case 'split':
      assertPlayerAction(state, ctx, phase);
      return;

    case 'takeInsurance':
    case 'declineInsurance':
      if (phase !== 'insurance') {
        throw new Error('Insurance not offered');
      }
      assertInsuranceDecision(state, ctx);
      return;

    case 'takeEvenMoney':
    case 'waitFor3to2':
      if (phase !== 'player' || !state.blackjack?.evenMoneyOfferHandKey) {
        throw new Error('Even-money not pending');
      }
      assertHandCaller(state, ctx, state.blackjack.evenMoneyOfferHandKey);
      return;

    case 'nextRound':
      // Round lifecycle is host-driven (same as shuffle/deal). The engine
      // re-validates awaitingNextRound and resets stakes/bets identically to
      // offline `startNextRoundOnState`.
      if (!state.tableMeta.awaitingNextRound) {
        throw new Error('No completed round awaiting Next Round');
      }
      assertTableHost(state, ctx.personId);
      return;

    case 'addGameToPersonalLedger':
      if (state.tableMeta.gameStatus !== 'ended') {
        throw new Error('Game must end before personal ledger');
      }
      if (hasPersonalLedgerEntryForTable(state.session.id)) {
        throw new Error('Already added to personal ledger');
      }
      return;

    case 'assignChips': {
      // personId-based authority (same pattern as configureTable/resetTable).
      // Display names are client-chosen and spoofable — never an identity.
      if (getTableAdminSettings(state).ownerOnlyCanAssignChips) {
        assertTableHost(state, ctx.personId, 'Not authorized to assign chips');
      }
      return;
    }

    case 'configureTable':
    case 'resetTable':
      assertTableHost(state, ctx.personId);
      return;

    case 'zilchStartGame':
    case 'zilchRandomiseStarter':
    case 'zilchConfirmStarter':
      assertTableHost(state, ctx.personId);
      return;

    case 'zilchRollDice':
    case 'zilchCompleteRoll':
    case 'zilchKeepCombination':
    case 'zilchBankTurn':
    case 'zilchQuitTurn':
    case 'zilchAdvanceAfterReveal':
      assertZilchPlayerTurn(state, ctx);
      return;

    case 'startHoldemHand':
      assertHoldemHostAction(state, ctx.personId, { blockMidHandStart: true });
      return;

    case 'holdemShuffleDeck':
      assertHoldemHostAction(state, ctx.personId, { blockMidHandShuffle: true });
      return;

    case 'updateHoldemBlinds':
      assertUpdateHoldemBlindsAuthorized(
        state,
        ctx.personId,
        Number(ctx.payload.smallBlind),
        Number(ctx.payload.bigBlind),
      );
      return;

    case 'endHoldemChallenge':
      assertEndHoldemChallengeAuthorized(state, ctx.personId);
      return;

    case 'holdemFold':
    case 'holdemCheck':
    case 'holdemCall':
      assertHoldemPlayerGameplayAction(state, ctx.personId, ctx.payload);
      return;

    case 'holdemBet':
    case 'holdemRaise': {
      assertHoldemPlayerGameplayAction(state, ctx.personId, ctx.payload);
      const amount = Number(ctx.payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('amount must be a positive number');
      }
      return;
    }

    case 'holdemAllIn':
      assertHoldemAllInAuthorized(state, ctx.personId, ctx.payload);
      return;

    case 'leaveTable':
    case 'createTable':
    case 'joinTable':
      return;

    default:
      throw new Error(`Unknown action: ${ctx.action as string}`);
  }
}

function assertHostDealAction(
  state: GameState,
  ctx: ActionContext,
  opts: { requireShoeStarted?: boolean; requireShoeNotStarted?: boolean },
): void {
  const phase = getBlackjackProtocolPhase(state);
  if (phase !== 'betting') {
    throw new Error('Action only allowed during betting');
  }
  if (state.tableMeta.bettingLocked && ctx.action === 'shuffleToStart') {
    throw new Error('Betting is locked');
  }
  if (!isBankerReady(state)) {
    throw new Error('Choose banker first');
  }
  if (opts.requireShoeStarted && !state.tableMeta.shoeStarted) {
    throw new Error('Shuffle before dealing');
  }
  if (opts.requireShoeNotStarted && state.tableMeta.shoeStarted) {
    throw new Error('Shoe already started');
  }
  if (opts.requireShoeNotStarted && !hasAnyStakes(state)) {
    throw new Error('Place at least one bet before shuffling');
  }
  if (opts.requireShoeStarted) {
    const authority = canDealBlackjack(state, ctx.personId);
    if (!authority.allowed) {
      throw new Error(authority.message ?? 'Cannot deal');
    }
    return;
  }
  assertTableHost(state, ctx.personId, 'Only the table host can deal cards.');
}

function assertZilchPlayerTurn(state: GameState, ctx: ActionContext): void {
  if (state.tableGame !== 'zilch' || !state.zilch) {
    throw new Error('Not a Zilch table');
  }
  if (!canControlZilchTurn(state, ctx.personId)) {
    throw new Error('Not your turn');
  }
}

function assertTableHost(
  state: GameState,
  personId: string,
  message = 'Only the table host may perform this action',
): void {
  const ownerId = state.tableMeta.ownerPersonId;
  if (ownerId && personId === ownerId) {
    return;
  }
  throw new Error(message);
}

function slotByNumber(state: GameState, slotNumber: number) {
  return state.tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber);
}

function findSlotByBoxPlayerId(state: GameState, boxPlayerId: string) {
  return state.tableMeta.boxSlots.find((s) => s.playerId === boxPlayerId);
}

function canClaimEmptySlot(state: GameState, personId: string, slotNumber: number): boolean {
  const slot = slotByNumber(state, slotNumber);
  if (!slot || slot.playerId) {
    return false;
  }
  if (state.tableMeta.ownerPersonId === personId) {
    return true;
  }
  return getAssignedSlotForPerson(state, personId) === slotNumber;
}

function assertBetPlacement(state: GameState, ctx: ActionContext): void {
  const boxId = ctx.payload.boxId as string | undefined;
  const slotNumberRaw = ctx.payload.slotNumber;
  const slotNumber = slotNumberRaw !== undefined ? Number(slotNumberRaw) : undefined;

  if (slotNumber !== undefined && Number.isFinite(slotNumber)) {
    if (canClaimEmptySlot(state, ctx.personId, slotNumber)) {
      return;
    }
    const slot = slotByNumber(state, slotNumber);
    if (slot?.playerId) {
      assertBetOnExistingBox(state, ctx.personId, slot.playerId);
      return;
    }
    throw new Error('Not authorized for this box');
  }

  if (!boxId) {
    throw new Error('boxId or slotNumber required');
  }
  assertBetOnExistingBox(state, ctx.personId, boxId);
}

function assertBetOnExistingBox(state: GameState, personId: string, boxId: string): void {
  const slot = findSlotByBoxPlayerId(state, boxId);
  if (!slot?.playerId) {
    throw new Error('Box not found');
  }
  // Shared betting: any seated table member may add chips; decision ownership is separate.
  if (!isSeatedPersonAtTable(state, personId)) {
    throw new Error('Not authorized for this box');
  }
}

function assertInsuranceDecision(state: GameState, ctx: ActionContext): void {
  const personId = ctx.payload.personId as string | undefined;
  if (personId) {
    if (personId !== ctx.personId) {
      throw new Error('Not authorized for this insurance decision');
    }
    const round = state.blackjack;
    if (!round?.insuranceOfferPending) {
      throw new Error('Insurance not offered');
    }
    const boxIds = getPendingInsuranceBoxIdsForPerson(state, round, ctx.personId);
    if (boxIds.length === 0) {
      throw new Error('No pending insurance decision');
    }
    return;
  }
  const boxPlayerId = ctx.payload.playerId as string;
  assertInsuranceBoxDecision(state, ctx, boxPlayerId);
}

function assertInsuranceBoxDecision(
  state: GameState,
  ctx: ActionContext,
  boxPlayerId: string,
): void {
  if (!boxPlayerId) {
    throw new Error('boxId required');
  }
  const owner = getInsuranceDecisionPersonIdForBox(state, boxPlayerId);
  if (owner !== ctx.personId) {
    throw new Error('Not authorized for this box');
  }
  if (!canPersonDecideInsuranceForBox(state, boxPlayerId, ctx.personId)) {
    throw new Error('Not authorized for this box');
  }
}

function assertBoxOwner(state: GameState, ctx: ActionContext, boxPlayerId: string): void {
  if (!boxPlayerId) {
    throw new Error('boxId required');
  }
  const caller = getCallerPersonIdForBox(state, boxPlayerId);
  if (caller !== ctx.personId) {
    throw new Error('Not authorized for this box');
  }
}

function assertHandCaller(state: GameState, ctx: ActionContext, handKey: string): void {
  const { playerId } = parseBlackjackHandKey(handKey);
  assertBoxOwner(state, ctx, playerId);
}

function assertPlayerAction(
  state: GameState,
  ctx: ActionContext,
  phase: ReturnType<typeof getBlackjackProtocolPhase>,
): void {
  if (phase !== 'player') {
    throw new Error('Not player turn phase');
  }
  const round = state.blackjack;
  if (!round?.activeHandKey) {
    throw new Error('No active hand');
  }

  // Normal player actions (hit/stand/double/split) always resolve against the
  // server-authoritative active hand. Any client-sent payload.handKey is
  // ignored to eliminate render-time "stale turn" drift after auto-stand /
  // multi-box advances. Box ownership is enforced on the active hand.
  const handKey = round.activeHandKey;
  const { playerId } = parseBlackjackHandKey(handKey);
  const caller = getCallerPersonIdForBox(state, playerId);
  if (caller !== ctx.personId) {
    throw new Error('Not box owner for this turn');
  }
}
