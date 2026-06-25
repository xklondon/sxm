import type { GameSession } from '../../types/session';
import type { Ledger } from '../../types/ledger';
import type { HoldemRound } from '../../types/holdem';
import { derivePlayerBalanceFromLedger } from '../ledger/ledger';
import { appendHoldemLedgerEntry } from './ledgerEntries';
import { appendActionLog, syncHoldemPot } from './helpers';

export type HoldemActionType = 'check' | 'bet' | 'call' | 'raise' | 'fold';

export interface HoldemActionContext {
  session: GameSession;
  ledger: Ledger;
  round: HoldemRound;
  playerId: string;
  amount?: number;
}

export interface HoldemActionResult {
  session: GameSession;
  ledger: Ledger;
  round: HoldemRound;
}

export function validateHoldemAction(ctx: HoldemActionContext): HoldemActionType | null {
  const { round, playerId, amount } = ctx;
  const ps = round.playerStates[playerId];

  if (!ps || ps.actionStatus === 'folded' || ps.actionStatus === 'all-in') {
    throw new Error('Player is not active in this hand');
  }
  if (round.activePlayerId !== playerId) {
    throw new Error('Not this player\'s turn');
  }
  if (!['preflop', 'flop', 'turn', 'river'].includes(round.status)) {
    throw new Error('Betting is not open');
  }

  const balance = derivePlayerBalanceFromLedger(playerId, ctx.ledger);
  const toCall = round.currentBet - ps.playerBetsThisStreet;

  if (toCall === 0 && (amount === undefined || amount === 0)) {
    return 'check';
  }
  if (toCall > 0 && amount === undefined) {
    return 'call';
  }
  if (amount !== undefined && amount > 0 && round.currentBet === 0) {
    return 'bet';
  }
  if (amount !== undefined && amount > round.currentBet) {
    return 'raise';
  }

  void balance;
  return null;
}

function commitChips(
  ctx: HoldemActionContext,
  entryType: import('../../types/ledger').LedgerEntryType,
  chipAmount: number,
  description: string,
): HoldemActionResult {
  if (chipAmount > 0) {
    const balance = derivePlayerBalanceFromLedger(ctx.playerId, ctx.ledger);
    if (chipAmount > balance) {
      throw new Error(`Not enough chips (balance ${balance}, need ${chipAmount})`);
    }
  }

  const ledgerResult = appendHoldemLedgerEntry(
    ctx.session,
    ctx.ledger,
    ctx.playerId,
    entryType,
    -chipAmount,
    description,
  );

  const ps = ctx.round.playerStates[ctx.playerId];
  const updatedPs = {
    ...ps,
    playerBetsThisStreet: ps.playerBetsThisStreet + chipAmount,
    playerTotalCommitted: ps.playerTotalCommitted + chipAmount,
    hasActedThisStreet: true,
    actionStatus: 'acted' as const,
  };

  let round = syncHoldemPot({
    ...ctx.round,
    playerStates: {
      ...ctx.round.playerStates,
      [ctx.playerId]: updatedPs,
    },
  });

  round = appendActionLog(round, description);

  return {
    session: ledgerResult.session,
    ledger: ledgerResult.ledger,
    round,
  };
}

function resetOthersActed(round: HoldemRound, exceptPlayerId: string): HoldemRound {
  const playerStates: HoldemRound['playerStates'] = {};
  for (const [id, ps] of Object.entries(round.playerStates)) {
    if (ps.actionStatus === 'folded' || ps.actionStatus === 'all-in') {
      playerStates[id] = ps;
    } else {
      playerStates[id] = {
        ...ps,
        hasActedThisStreet: id === exceptPlayerId,
        actionStatus: id === exceptPlayerId ? 'acted' : 'active',
      };
    }
  }
  return { ...round, playerStates };
}

export function checkHoldemPlayer(ctx: HoldemActionContext): HoldemActionResult {
  const ps = ctx.round.playerStates[ctx.playerId];
  const toCall = ctx.round.currentBet - ps.playerBetsThisStreet;
  if (toCall > 0) {
    throw new Error('Cannot check when a bet is outstanding');
  }

  const round = appendActionLog(
    {
      ...ctx.round,
      playerStates: {
        ...ctx.round.playerStates,
        [ctx.playerId]: { ...ps, hasActedThisStreet: true, actionStatus: 'acted' },
      },
    },
    `${ctx.playerId} checks`,
  );

  return { session: ctx.session, ledger: ctx.ledger, round };
}

export function betHoldemPlayer(ctx: HoldemActionContext): HoldemActionResult {
  const amount = ctx.amount ?? 0;
  if (amount <= 0) {
    throw new Error('Bet amount must be positive');
  }
  if (ctx.round.currentBet > 0) {
    throw new Error('Cannot bet when a bet already exists — use raise');
  }
  if (amount < ctx.round.bigBlind) {
    throw new Error(`Minimum bet is ${ctx.round.bigBlind}`);
  }

  const result = commitChips(
    ctx,
    'bet-placed',
    amount,
    `Bet ${amount} chips`,
  );

  return {
    ...result,
    round: resetOthersActed(
      {
        ...result.round,
        currentBet: amount,
        lastRaiseSize: amount,
      },
      ctx.playerId,
    ),
  };
}

export function callHoldemPlayer(ctx: HoldemActionContext): HoldemActionResult {
  const ps = ctx.round.playerStates[ctx.playerId];
  const toCall = ctx.round.currentBet - ps.playerBetsThisStreet;
  if (toCall <= 0) {
    throw new Error('Nothing to call — check instead');
  }

  return commitChips(
    ctx,
    'call-placed',
    toCall,
    `Call ${toCall} chips`,
  );
}

export function raiseHoldemPlayer(ctx: HoldemActionContext): HoldemActionResult {
  const targetTotal = ctx.amount ?? 0;
  const ps = ctx.round.playerStates[ctx.playerId];
  const minRaiseTo = ctx.round.currentBet + ctx.round.lastRaiseSize;
  if (targetTotal < minRaiseTo) {
    throw new Error(`Minimum raise to ${minRaiseTo}`);
  }

  const additional = targetTotal - ps.playerBetsThisStreet;
  if (additional <= 0) {
    throw new Error('Raise must increase your street commitment');
  }

  const raiseSize = targetTotal - ctx.round.currentBet;
  const result = commitChips(
    ctx,
    'bet-increased',
    additional,
    `Raise to ${targetTotal} chips`,
  );

  return {
    ...result,
    round: resetOthersActed(
      {
        ...result.round,
        currentBet: targetTotal,
        lastRaiseSize: Math.max(raiseSize, ctx.round.bigBlind),
      },
      ctx.playerId,
    ),
  };
}

export function foldHoldemPlayer(ctx: HoldemActionContext): HoldemActionResult {
  const ps = ctx.round.playerStates[ctx.playerId];
  const ledgerResult = appendHoldemLedgerEntry(
    ctx.session,
    ctx.ledger,
    ctx.playerId,
    'fold-recorded',
    0,
    `${ctx.playerId} folds`,
  );

  const round = appendActionLog(
    {
      ...ctx.round,
      playerStates: {
        ...ctx.round.playerStates,
        [ctx.playerId]: {
          ...ps,
          actionStatus: 'folded',
          hasActedThisStreet: true,
        },
      },
    },
    `${ctx.playerId} folds`,
  );

  return {
    session: ledgerResult.session,
    ledger: ledgerResult.ledger,
    round,
  };
}

export function allInHoldemPlayer(ctx: HoldemActionContext): HoldemActionResult {
  const ps = ctx.round.playerStates[ctx.playerId];
  if (!ps || ps.actionStatus === 'folded' || ps.actionStatus === 'all-in') {
    throw new Error('Player is not active in this hand');
  }
  if (ctx.round.activePlayerId !== ctx.playerId) {
    throw new Error('Not this player\'s turn');
  }

  const balance = derivePlayerBalanceFromLedger(ctx.playerId, ctx.ledger);
  if (balance <= 0) {
    throw new Error('No chips remaining to go all-in');
  }

  const chipAmount = balance;
  const newStreetBet = ps.playerBetsThisStreet + chipAmount;
  const isRaise = newStreetBet > ctx.round.currentBet;

  const ledgerResult = appendHoldemLedgerEntry(
    ctx.session,
    ctx.ledger,
    ctx.playerId,
    'side-pot-contribution',
    -chipAmount,
    `All-in ${chipAmount} chips`,
  );

  const updatedPs = {
    ...ps,
    playerBetsThisStreet: newStreetBet,
    playerTotalCommitted: ps.playerTotalCommitted + chipAmount,
    hasActedThisStreet: true,
    actionStatus: 'all-in' as const,
  };

  let round = syncHoldemPot({
    ...ctx.round,
    playerStates: {
      ...ctx.round.playerStates,
      [ctx.playerId]: updatedPs,
    },
  });

  round = appendActionLog(round, `${ctx.playerId} all-in ${chipAmount}`);

  if (isRaise) {
    const raiseSize = newStreetBet - ctx.round.currentBet;
    round = resetOthersActed(
      {
        ...round,
        currentBet: newStreetBet,
        lastRaiseSize: Math.max(raiseSize, ctx.round.bigBlind),
      },
      ctx.playerId,
    );
    round.playerStates[ctx.playerId] = {
      ...round.playerStates[ctx.playerId],
      actionStatus: 'all-in',
      hasActedThisStreet: true,
    };
  }

  return {
    session: ledgerResult.session,
    ledger: ledgerResult.ledger,
    round,
  };
}

export function postBlind(
  ctx: HoldemActionContext,
  blindType: 'small' | 'big',
  amount: number,
): HoldemActionResult {
  const label = blindType === 'small' ? 'Small blind' : 'Big blind';
  const balance = derivePlayerBalanceFromLedger(ctx.playerId, ctx.ledger);
  if (amount > balance) {
    throw new Error(`${label}: not enough chips (balance ${balance})`);
  }

  const ledgerResult = appendHoldemLedgerEntry(
    ctx.session,
    ctx.ledger,
    ctx.playerId,
    'blind-posted',
    -amount,
    `${label}: ${amount} chips`,
  );

  const ps = ctx.round.playerStates[ctx.playerId];
  const updatedPs = {
    ...ps,
    playerBetsThisStreet: ps.playerBetsThisStreet + amount,
    playerTotalCommitted: ps.playerTotalCommitted + amount,
    hasActedThisStreet: blindType === 'big' ? false : true,
    actionStatus: 'active' as const,
  };

  let round = syncHoldemPot({
    ...ctx.round,
    playerStates: {
      ...ctx.round.playerStates,
      [ctx.playerId]: updatedPs,
    },
    currentBet: Math.max(ctx.round.currentBet, amount),
    lastRaiseSize: ctx.round.bigBlind,
  });

  round = appendActionLog(round, `${label} ${amount} by ${ctx.playerId}`);

  return {
    session: ledgerResult.session,
    ledger: ledgerResult.ledger,
    round,
  };
}
