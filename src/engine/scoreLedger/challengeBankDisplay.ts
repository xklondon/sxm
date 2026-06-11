import type { GameState } from '../../types';

function personShortName(state: GameState, personId: string): string {
  const person = state.players[personId];
  return person?.controllerName?.trim() || person?.displayName || 'Player';
}

function bankShortName(state: GameState, bankId: string): string {
  const bank = state.players[bankId];
  if (!bank) {
    return 'Bank';
  }
  if (bank.playerType === 'virtual') {
    return bank.displayName.replace(/^Bank\s+/i, '').trim() || 'Dealer';
  }
  return bank.controllerName?.trim() || bank.displayName;
}

export function isChallengeTable(state: GameState): boolean {
  if (state.tableMeta.tableMode) {
    return state.tableMeta.tableMode === 'challenge';
  }
  const bankId = state.session.bankPlayerId;
  const bank = bankId ? state.players[bankId] : null;
  return bank?.playerType !== 'virtual';
}

/** Challenge: bank seat is a person; practice: bot bank may read as house/dealer. */
export function formatBankHolderLabel(state: GameState, bankId: string): string {
  if (isChallengeTable(state)) {
    return personShortName(state, bankId);
  }
  return `Bank (${bankShortName(state, bankId)})`;
}

/** End-of-game winner line — challenge bank wins credit the acting player. */
export function resolveWinnerDisplayName(state: GameState, winnerId: string): string {
  const bankId = state.session.bankPlayerId;
  const winnerIsBank = Boolean(bankId && winnerId === bankId);

  if (winnerIsBank && isChallengeTable(state) && bankId) {
    return `${personShortName(state, bankId)} wins as Bank`;
  }

  if (winnerIsBank && bankId) {
    return bankShortName(state, bankId);
  }

  const name = personShortName(state, winnerId);
  return name || 'Player';
}

/** Ledger / score entry winner person id — never anonymous bank in challenge. */
export function resolveLedgerWinnerPersonId(
  state: GameState,
  winnerId: string | null,
): string | null {
  if (!winnerId) {
    return null;
  }
  const bankId = state.session.bankPlayerId;
  const winnerIsBank = Boolean(bankId && winnerId === bankId);
  if (winnerIsBank && !isChallengeTable(state)) {
    return null;
  }
  return winnerId;
}

export { personShortName, bankShortName };
