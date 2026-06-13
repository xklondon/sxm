import type { GameState } from '../../types';
import type { BankerSetup } from '../../types/table';
import { createEmptyLedger } from '../../types/ledger';
import { createEmptyBoxSlots, MAX_TABLE_BOXES, type BoxSlotState } from '../../types/table';
import { log } from '../../utils/logger';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import {
  addPlayer,
  assignBankOrDealer,
  mergeSessionUpdate,
  removePlayer,
} from './session';
import {
  allocateChipsToBankrollOwner,
  createParticipantWithAllocation,
  logDerivedBalances,
  logLedgerAfterAllocation,
} from './allocation';
import {
  getStartingChipsBank,
  getStartingChipsEachSeat,
  logSetupValues,
  logTableMetaStartingChips,
} from './tokens';
import {
  findPersonPlayerIdByController,
} from './bankroll';
import { personsShareOneChipPot, resolveCanonicalBankrollOwnerId } from './sharedBankroll';
import { syncPlayerOrderAndAssignments } from './playerAssignment';

function slotByNumber(state: GameState, slotNumber: number) {
  return state.tableMeta.boxSlots.find((s) => s.slotNumber === slotNumber);
}

export function setControllerName(state: GameState, name: string): GameState {
  const trimmed = name.trim();
  return {
    ...state,
    tableMeta: { ...state.tableMeta, controllerName: trimmed },
  };
}

export function isBankerReady(state: GameState): boolean {
  return state.tableMeta.bankerSetup.mode !== 'unset' && state.session.bankPlayerId !== null;
}

function withBankerSetup(state: GameState, setup: BankerSetup): GameState {
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      bankerSetup: setup,
      showBankerSetup: false,
    },
  };
}

function syncBankParticipantId(state: GameState, bankId: string): GameState {
  return {
    ...state,
    session: assignBankOrDealer(state.session, bankId),
    tableMeta: {
      ...state.tableMeta,
      bankerSetup: {
        ...state.tableMeta.bankerSetup,
        playerId: bankId,
      },
    },
  };
}

export function assignBankBot(state: GameState, startBalance?: number): GameState {
  const chips = startBalance ?? getStartingChipsBank(state);
  logTableMetaStartingChips(state, 'assignBankBot');

  if (state.session.bankPlayerId && state.players[state.session.bankPlayerId]) {
    const bankId = state.session.bankPlayerId;
    const current = derivePlayerBalanceFromLedger(bankId, state.ledger);
    let next = state;
    if (current === 0 && chips > 0) {
      next = allocateChipsToBankrollOwner(next, {
        bankrollOwnerId: bankId,
        amount: chips,
        reason: 'initial-bank',
        source: 'setup',
      });
    }
    log.info('allocateBank', { bankId, chips, mode: 'bot', existing: true });
    logLedgerAfterAllocation(next, 'allocateBank-bot-existing');
    logDerivedBalances(next, 'allocateBank-bot-existing');
    const setup: BankerSetup = {
      mode: 'bot',
      displayName: 'Bank Bot',
      playerId: bankId,
      startBalance: chips,
    };
    return withBankerSetup(
      {
        ...next,
        players: {
          ...next.players,
          [bankId]: {
            ...next.players[bankId]!,
            playerType: 'virtual',
            virtualStyle: 'conservative',
          },
        },
      },
      setup,
    );
  }

  const created = createParticipantWithAllocation(
    state,
    {
      displayName: 'Bank Bot',
      controllerName: 'Bank Bot',
      role: 'bank',
    },
    chips,
    'starting-allocation',
    'setup',
  );
  let next = syncBankParticipantId(created.state, created.participantId);
  next = {
    ...next,
    players: {
      ...next.players,
      [created.participantId]: {
        ...next.players[created.participantId]!,
        playerType: 'virtual',
        virtualStyle: 'conservative',
      },
    },
  };

  log.info('allocateBank', { bankId: created.participantId, chips, mode: 'bot' });
  logLedgerAfterAllocation(next, 'allocateBank-bot');
  logDerivedBalances(next, 'allocateBank-bot');

  const setup: BankerSetup = {
    mode: 'bot',
    displayName: 'Bank Bot',
    playerId: created.participantId,
    startBalance: chips,
  };
  log.info('Banker assigned: Bank Bot');
  return withBankerSetup(next, setup);
}

export function assignBankPerson(
  state: GameState,
  personName: string,
  startBalance?: number,
): GameState {
  const name = personName.trim();
  if (!name) {
    throw new Error('Enter a name for the banker');
  }
  const chips = startBalance ?? getStartingChipsBank(state);
  logTableMetaStartingChips(state, 'assignBankPerson');

  const created = createParticipantWithAllocation(
    state,
    {
      displayName: name,
      controllerName: name,
      role: 'bank',
    },
    chips,
    'starting-allocation',
    'setup',
  );
  const next = syncBankParticipantId(created.state, created.participantId);

  log.info('allocateBank', { bankId: created.participantId, chips, mode: 'person', name });
  logLedgerAfterAllocation(next, 'allocateBank-person');
  logDerivedBalances(next, 'allocateBank-person');

  const setup: BankerSetup = {
    mode: 'person',
    displayName: name,
    playerId: created.participantId,
    startBalance: chips,
  };
  log.info('Banker assigned', { name });
  return withBankerSetup(next, setup);
}

export function claimBoxSlot(state: GameState, slotNumber: number): GameState {
  if (slotNumber < 1 || slotNumber > MAX_TABLE_BOXES) {
    throw new Error('Invalid box slot');
  }
  const slot = slotByNumber(state, slotNumber);
  if (!slot) {
    throw new Error('Box slot not found');
  }
  if (slot.playerId) {
    return { ...state, selectedSeatId: slot.playerId };
  }

  logTableMetaStartingChips(state, 'claimBoxSlot');
  const chips = getStartingChipsEachSeat(state);
  const controller = state.tableMeta.controllerName.trim() || 'Guest';

  log.info('claimBoxBeforeAllocation', {
    slotNumber,
    chips,
    controller,
    sessionPlayerIds: [...state.session.playerIds],
    ledgerEntryCount: state.ledger.entries.length,
  });

  log.info('claimBoxResolvePerson', { slotNumber, controller });

  let next = state;
  const ownerPersonId = next.tableMeta.ownerPersonId;
  const ownerName = next.tableMeta.owner?.ownerName?.trim();
  let personId: string | null = null;

  if (
    ownerPersonId &&
    next.players[ownerPersonId] &&
    (controller.toLowerCase() === (ownerName?.toLowerCase() ?? '') ||
      controller.toLowerCase() ===
        (next.players[ownerPersonId]?.controllerName?.trim().toLowerCase() ?? ''))
  ) {
    personId = ownerPersonId;
  }
  if (!personId) {
    personId = findPersonPlayerIdByController(next, controller);
  }
  let allocated = false;

  if (!personId) {
    const personSpl = addPlayer(next.session, next.players, next.ledger, {
      displayName: controller,
      controllerName: controller,
      role: 'person',
      startingChips: 0,
    });
    next = mergeSessionUpdate(next, personSpl);
    personId = personSpl.session.playerIds[personSpl.session.playerIds.length - 1]!;

    const balanceBefore = derivePlayerBalanceFromLedger(personId, next.ledger);
    const bankId = next.session.bankPlayerId;
    const sharesBankPot =
      bankId !== null && personsShareOneChipPot(next, personId, bankId);
    if (balanceBefore === 0 && chips > 0 && !sharesBankPot) {
      next = allocateChipsToBankrollOwner(next, {
        bankrollOwnerId: personId,
        amount: chips,
        reason: 'initial-player',
        source: 'claim-box',
        boxId: String(slotNumber),
      });
      allocated = true;
      log.info('claimBoxNewBankrollAllocated', {
        personId,
        controller,
        slotNumber,
        chips,
      });
    }
  } else {
    log.info('claimBoxExistingBankroll', {
      personId,
      controller,
      slotNumber,
    });
  }

  const bankrollOwnerId = resolveCanonicalBankrollOwnerId(next, personId);

  const boxSpl = addPlayer(next.session, next.players, next.ledger, {
    displayName: `Box ${slotNumber}`,
    controllerName: controller,
    role: 'box',
    bankrollOwnerId,
    startingChips: 0,
  });
  next = mergeSessionUpdate(next, boxSpl);
  const boxPlayerId = boxSpl.session.playerIds[boxSpl.session.playerIds.length - 1]!;

  const boxSlots = next.tableMeta.boxSlots.map((s) =>
    s.slotNumber === slotNumber
      ? {
          ...s,
          playerId: boxPlayerId,
          bankrollOwnerId,
          nativeAssignedPersonId:
            s.nativeAssignedPersonId ??
            (next.tableMeta.assignedBoxByPersonId?.[personId] === slotNumber
              ? personId
              : null),
          callerPersonId: null,
        }
      : s,
  );

  next = {
    ...next,
    session: {
      ...next.session,
      boxSlotNumbers: {
        ...next.session.boxSlotNumbers,
        [boxPlayerId]: slotNumber,
      },
    },
    tableMeta: { ...next.tableMeta, boxSlots },
    selectedSeatId: boxPlayerId,
  };

  const balanceAfter = derivePlayerBalanceFromLedger(bankrollOwnerId, next.ledger);
  log.info('claimBoxLinkedToBankroll', {
    slotNumber,
    boxPlayerId,
    personId,
    bankrollOwnerId,
    chipsAllocated: allocated ? chips : 0,
    personBalanceAfter: balanceAfter,
  });
  log.info('boxLedgerBalanceAfterAllocation', {
    personId,
    balanceAfter,
    slotNumber,
    boxPlayerId,
  });
  logLedgerAfterAllocation(next, 'claimBoxSlot');
  logDerivedBalances(next, 'claimBoxSlot');
  log.info('Box claimed', { slotNumber, controller, boxPlayerId, personId });

  return syncPlayerOrderAndAssignments(next);
}

export function releaseBoxSlot(state: GameState, slotNumber: number): GameState {
  const slot = slotByNumber(state, slotNumber);
  if (!slot?.playerId) {
    return state;
  }
  const playerId = slot.playerId;
  const update = removePlayer(state.session, state.players, state.ledger, playerId);
  const restSlots = { ...state.session.boxSlotNumbers };
  delete restSlots[playerId];
  const boxSlots = state.tableMeta.boxSlots.map((s) => {
    if (s.slotNumber !== slotNumber) {
      return s;
    }
    const nativeId =
      Object.entries(state.tableMeta.assignedBoxByPersonId ?? {}).find(
        ([, slot]) => slot === slotNumber,
      )?.[0] ?? s.nativeAssignedPersonId;
    return {
      ...s,
      playerId: null,
      bankrollOwnerId: null,
      passiveNames: [],
      callerPersonId: null,
      nativeAssignedPersonId: nativeId ?? null,
    };
  });
  const nextSelected =
    state.selectedSeatId === playerId ? null : state.selectedSeatId;
  log.info('Box released', { slotNumber });
  return {
    ...mergeSessionUpdate(state, update),
    session: { ...update.session, boxSlotNumbers: restSlots },
    tableMeta: { ...state.tableMeta, boxSlots },
    selectedSeatId: nextSelected,
  };
}

export function registerPassiveBet(
  state: GameState,
  boxPlayerId: string,
  bettorName: string,
): GameState {
  const owner = state.players[boxPlayerId]?.controllerName;
  if (!owner || bettorName === owner) {
    return state;
  }
  const slotNum = state.session.boxSlotNumbers?.[boxPlayerId];
  if (!slotNum) {
    return state;
  }
  const boxSlots = state.tableMeta.boxSlots.map((s) => {
    if (s.slotNumber !== slotNum) {
      return s;
    }
    const passiveNames = s.passiveNames.includes(bettorName)
      ? s.passiveNames
      : [...s.passiveNames, bettorName];
    return { ...s, passiveNames };
  });
  return { ...state, tableMeta: { ...state.tableMeta, boxSlots } };
}

export function startNewGameWithWager(
  state: GameState,
  stakeDescription: string,
  startingChipsEachSeat: number,
  startingChipsBank?: number,
): GameState {
  const bankChips = startingChipsBank ?? startingChipsEachSeat;
  logSetupValues(stakeDescription, startingChipsEachSeat, bankChips);

  const sessionId = state.session.id;
  const ledger = createEmptyLedger(sessionId);
  const session = {
    ...state.session,
    currentRound: 1,
    ledgerEntryIds: [],
    deckId: null,
    dealingStatus: 'no-deck' as const,
    status: 'active' as const,
    playerIds: [] as string[],
    bankPlayerId: null as string | null,
    boxSlotNumbers: {},
  };

  const agreement = {
    stakeDescription: stakeDescription.trim() || 'Friendly game',
    defaultChips: startingChipsEachSeat,
    agreedAt: new Date().toISOString(),
  };

  log.info('New game started', {
    wager: agreement.stakeDescription,
    startingChipsEachSeat,
    startingChipsBank: bankChips,
  });

  const next: GameState = {
    ...state,
    session,
    players: {},
    ledger,
    deck: null,
    blackjack: null,
    holdem: null,
    zilch: null,
    selectedSeatId: null,
    tableMeta: {
      agreement,
      outcome: null,
      status: 'open',
      showStakeSetup: false,
      showBankerSetup: true,
      bankerSetup: {
        mode: 'unset',
        displayName: '',
        playerId: null,
        startBalance: bankChips,
      },
      boxSlots: createEmptyBoxSlots(),
      controllerName: state.tableMeta.controllerName,
      owner: state.tableMeta.owner,
      ownerPersonId: null,
      playerOrder: [],
      assignedBoxByPersonId: {},
      invites: state.tableMeta.invites,
      protocolLocked: false,
      boxStakes: {},
      bettingLocked: false,
      shoeStarted: false,
      startingChipsEachSeat,
      startingChipsBank: bankChips,
      minimumBet: state.tableMeta.minimumBet ?? 5,
      awaitingNextRound: false,
      gameStatus: 'active',
      winnerId: null,
      endedAt: null,
      wagerVoucherStatus: 'not-created',
    },
  };

  logTableMetaStartingChips(next, 'startNewGameWithWager');
  return next;
}

export function getSlotForPlayer(state: GameState, playerId: string): BoxSlotState | undefined {
  const num = state.session.boxSlotNumbers?.[playerId];
  if (!num) {
    return undefined;
  }
  return state.tableMeta.boxSlots.find((s) => s.slotNumber === num);
}

export function boxLabelForPlayer(state: GameState, playerId: string): string {
  const num = state.session.boxSlotNumbers?.[playerId];
  return num ? `Box ${num}` : state.players[playerId]?.displayName ?? 'Box';
}
