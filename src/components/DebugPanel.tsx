import type { GameState } from '../types';
import { getBlackjackProtocolForState } from '../engine/blackjack/protocolState';
import { getBlackjackProtocolPhase } from '../engine/blackjack/protocol';
import { buildAccountRows } from '../engine/session/balances';
import {
  getAvailableChipsForBankrollOwner,
  getLedgerBalanceForBankrollOwner,
  getTotalBettingExposureForBankrollOwner,
  listPersonBankrollOwnerIds,
} from '../engine/session/bankroll';
import { getEligibleDealBoxes } from '../engine/blackjack/dealEligibility';
import { getBoxesWithStakes } from '../engine/blackjack/stakes';
import './DebugPanel.css';

interface DebugPanelProps {
  gameState: GameState;
}

export function DebugPanel({ gameState }: DebugPanelProps) {
  const protocol = getBlackjackProtocolForState(gameState);
  const phase = getBlackjackProtocolPhase(gameState);
  const round = gameState.blackjack;
  const accounts = buildAccountRows(gameState);
  const eligible = getEligibleDealBoxes(gameState);
  const staked = getBoxesWithStakes(gameState);
  const bankId = gameState.session.bankPlayerId;
  const personBankrollIds = listPersonBankrollOwnerIds(gameState);

  return (
    <section className="debug-panel" aria-label="Debug info">
      <h4 className="debug-panel__title">Dev / Debug</h4>
      <dl className="debug-panel__grid">
        <dt>Protocol</dt>
        <dd>{protocol.displayName}</dd>
        <dt>Protocol locked</dt>
        <dd>{gameState.tableMeta.protocolLocked ? 'yes' : 'no'}</dd>
        <dt>Phase</dt>
        <dd>{phase}</dd>
        <dt>Round status</dt>
        <dd>{round?.status ?? 'none'}</dd>
        <dt>Active hand</dt>
        <dd>{round?.activeHandKey ?? '—'}</dd>
        <dt>Eligible deal boxes</dt>
        <dd>{eligible.join(', ') || '—'}</dd>
        <dt>Staked boxes</dt>
        <dd>{staked.join(', ') || '—'}</dd>
        <dt>Design template</dt>
        <dd>{gameState.designTemplateId}</dd>
        <dt>Deal mode</dt>
        <dd>{gameState.blackjackFlowSettings.initialDealMode}</dd>
      </dl>
      <details className="debug-panel__accounts">
        <summary>Bankroll debug ({accounts.length} rows)</summary>
        <ul>
          {bankId && (
            <li>
              Bank {bankId.slice(0, 8)}… — ledger{' '}
              {getLedgerBalanceForBankrollOwner(gameState, bankId)}c, exposure 0, available{' '}
              {getAvailableChipsForBankrollOwner(gameState, bankId)}c
            </li>
          )}
          {personBankrollIds.map((personId) => {
            const ledger = getLedgerBalanceForBankrollOwner(gameState, personId);
            const exposure = getTotalBettingExposureForBankrollOwner(gameState, personId);
            const available = getAvailableChipsForBankrollOwner(gameState, personId);
            const label =
              gameState.players[personId]?.controllerName ??
              gameState.players[personId]?.displayName ??
              personId.slice(0, 8);
            return (
              <li key={personId}>
                {label} — bankroll {personId.slice(0, 8)}… — ledger {ledger}c, exposure {exposure}c,
                available {available}c
              </li>
            );
          })}
        </ul>
      </details>
      <details className="debug-panel__stakes">
        <summary>Box stakes</summary>
        <pre>{JSON.stringify(gameState.tableMeta.boxStakes, null, 2)}</pre>
      </details>
    </section>
  );
}
