import { useEffect } from 'react';
import type { GameState } from '../types';
import {
  buildTableBankRow,
  buildTablePeopleRows,
  logThisTableBalanceDebug,
  type TablePersonStatus,
} from '../engine/session/tablePeople';
import { getEffectivePlayerOrder } from '../engine/session/playerAssignment';
import { getPlayFlowForPerson, PLAY_FLOW_OPTIONS } from '../engine/blackjack';
import type { PlayFlowAutoStand } from '../storage/profileStorage';
import { ChipStack } from './ChipStack';
import { SXM_LAYOUT, sxmSectionProps } from './sxmLayoutContract';
import './TableAccountsPanel.css';

interface TableAccountsPanelProps {
  gameState: GameState;
  showAssignButton?: boolean;
  onAssignChips?: () => void;
  onInvite?: () => void;
  onSaveTable?: () => void;
  onMovePlayer?: (personId: string, direction: 'up' | 'down') => void;
  onPlayFlowChange?: (personId: string, playFlow: PlayFlowAutoStand) => void;
  showPlayerOrderControls?: boolean;
  /** Slide drawer variant — drops inline dock chrome. */
  variant?: 'inline' | 'slide';
}

function statusLabel(status: TablePersonStatus): string {
  switch (status) {
    case 'owner':
      return 'Owner';
    case 'active':
      return 'Active';
    case 'invited':
      return 'Invited';
    case 'pending':
      return 'Pending';
    default:
      return status;
  }
}

export function TableAccountsPanel({
  gameState,
  showAssignButton = false,
  onAssignChips,
  onInvite,
  onSaveTable,
  onMovePlayer,
  onPlayFlowChange,
  showPlayerOrderControls = false,
  variant = 'inline',
}: TableAccountsPanelProps) {
  const bank = buildTableBankRow(gameState);
  const people = buildTablePeopleRows(gameState);
  const playerOrder = getEffectivePlayerOrder(gameState);

  useEffect(() => {
    logThisTableBalanceDebug(gameState);
  }, [gameState]);

  return (
    <aside
      className={`bj-accounts-panel${variant === 'slide' ? ' bj-accounts-panel--slide' : ''}`}
      aria-label="This Table"
    >

      {!bank && people.length === 0 ? (
        <p className="bj-accounts-panel__empty">Complete setup to see bank and players.</p>
      ) : (
        <>
          {bank && (
            <section
              {...sxmSectionProps(SXM_LAYOUT.tableInfoPanel, 'bj-accounts-panel__section')}
            >
              <div className="bj-accounts-panel__row bj-accounts-panel__row--bank">
                <p className="bj-accounts-panel__bank-name">Bank: {bank.bankName}</p>
                <p className="bj-accounts-panel__balance-line">Balance: {bank.balance}</p>
                {bank.balance > 0 && (
                  <div className="bj-accounts-panel__chips">
                    <ChipStack amount={bank.balance} variant="balance" />
                  </div>
                )}
              </div>
            </section>
          )}

          {people.length > 0 && (
            <section
              {...sxmSectionProps(SXM_LAYOUT.playersPanel, 'bj-accounts-panel__section')}
            >
              <h4 className="bj-accounts-panel__section-title">Players</h4>
              <ul className="bj-accounts-panel__list">
                {people.map((row) => {
                  const orderIndex = row.personId ? playerOrder.indexOf(row.personId) : -1;
                  const canMoveUp = showPlayerOrderControls && orderIndex > 0;
                  const canMoveDown =
                    showPlayerOrderControls &&
                    orderIndex >= 0 &&
                    orderIndex < playerOrder.length - 1;

                  return (
                    <li
                      key={row.key}
                      className={`bj-accounts-panel__row bj-accounts-panel__row--${row.kind}`}
                    >
                      <div className="bj-accounts-panel__head">
                        <span className="bj-accounts-panel__label">
                          {row.label}
                          <span className={`bj-accounts-panel__status bj-accounts-panel__status--${row.status}`}>
                            {statusLabel(row.status)}
                          </span>
                        </span>
                        {row.kind === 'person' && showPlayerOrderControls && onMovePlayer && row.personId && (
                          <span className="bj-accounts-panel__order">
                            <button
                              type="button"
                              className="bj-accounts-panel__order-btn"
                              disabled={!canMoveUp}
                              aria-label={`Move ${row.label} up`}
                              onClick={() => onMovePlayer(row.personId!, 'up')}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="bj-accounts-panel__order-btn"
                              disabled={!canMoveDown}
                              aria-label={`Move ${row.label} down`}
                              onClick={() => onMovePlayer(row.personId!, 'down')}
                            >
                              ↓
                            </button>
                          </span>
                        )}
                      </div>
                      {row.showBalance && (
                        <>
                          <div className="bj-accounts-panel__nums">
                            <span className="bj-accounts-panel__available">
                              Available: {row.available}
                            </span>
                            {row.betting > 0 && (
                              <span className="bj-accounts-panel__bet">Betting: {row.betting}</span>
                            )}
                          </div>
                          {row.assignedBox != null && (
                            <span className="bj-accounts-panel__assigned">
                              Assigned: Box {row.assignedBox}
                            </span>
                          )}
                          {row.boxSlots.length > 0 ? (
                            <span className="bj-accounts-panel__boxes">
                              Boxes: {row.boxSlots.join(', ')}
                            </span>
                          ) : (
                            row.kind === 'person' && (
                              <span className="bj-accounts-panel__boxes">Boxes: —</span>
                            )
                          )}
                          {row.kind === 'person' && row.personId && onPlayFlowChange && (
                            <label className="bj-accounts-panel__play-flow">
                              Play Flow
                              <select
                                value={getPlayFlowForPerson(gameState, row.personId)}
                                onChange={(e) =>
                                  onPlayFlowChange(row.personId!, e.target.value as PlayFlowAutoStand)
                                }
                              >
                                {PLAY_FLOW_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      {showAssignButton && onAssignChips && (
        <button type="button" className="bj-accounts-panel__assign secondary" onClick={onAssignChips}>
          Assign chips
        </button>
      )}

      {onInvite && (
        <button type="button" className="bj-accounts-panel__invite secondary" onClick={onInvite}>
          Invite to table
        </button>
      )}

      {onSaveTable && (
        <button type="button" className="bj-accounts-panel__save secondary" onClick={onSaveTable}>
          Save and close table
        </button>
      )}
    </aside>
  );
}
