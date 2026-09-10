import { useState, type FormEvent } from 'react';
import { POKER0_TABLE_PANEL } from '../poker0LayoutContract';
import { PokerBlindsControl } from './PokerBlindsControl';
import type { PokerChatMessage, PokerSeatViewModel } from '../state/pokerTypes';
import type { TableResetSetupVariant } from '../../../components/TableStakePanel';

const ADD_CHIPS_AMOUNT = 100;

export interface PokerTablePanelProps {
  open: boolean;
  onClose: () => void;
  seats: PokerSeatViewModel[];
  isPractice: boolean;
  isChallenge: boolean;
  canEditBlinds: boolean;
  canAddChips: boolean;
  canResetTable: boolean;
  showInvite: boolean;
  showEndChallenge: boolean;
  showStartHand: boolean;
  showShuffleDeck: boolean;
  startHandLabel: string;
  smallBlind: number;
  bigBlind: number;
  chatMessages: PokerChatMessage[];
  actionLog: string[];
  chatSending?: boolean;
  onSendChat?: (message: string) => void;
  onSaveBlinds?: (smallBlind: number, bigBlind: number) => void;
  onInviteTable?: () => void;
  onLeaveTable?: () => void;
  onEndChallenge?: () => void;
  onStartHand?: () => void;
  onShuffleDeck?: () => void;
  onBeginTableReset?: (variant?: TableResetSetupVariant) => void;
  onAddChips?: (playerId: string, amount: number) => void;
}

export function PokerTablePanel({
  open,
  onClose,
  seats,
  isPractice,
  isChallenge,
  canEditBlinds,
  canAddChips,
  canResetTable,
  showInvite,
  showEndChallenge,
  showStartHand,
  showShuffleDeck,
  startHandLabel,
  smallBlind,
  bigBlind,
  chatMessages,
  actionLog,
  chatSending = false,
  onSendChat,
  onSaveBlinds,
  onInviteTable,
  onLeaveTable,
  onEndChallenge,
  onStartHand,
  onShuffleDeck,
  onBeginTableReset,
  onAddChips,
}: PokerTablePanelProps) {
  const [chatDraft, setChatDraft] = useState('');
  const [showBlindsEditor, setShowBlindsEditor] = useState(false);

  if (!open) {
    return null;
  }

  function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = chatDraft.trim();
    if (!trimmed || !onSendChat) {
      return;
    }
    onSendChat(trimmed);
    setChatDraft('');
  }

  return (
    <>
      <button
        type="button"
        className="poker-table-panel__backdrop"
        aria-label="Close This Table panel"
        onClick={onClose}
      />
      <aside className={`poker-table-panel ${POKER0_TABLE_PANEL}`} role="dialog" aria-label="This Table">
        <header className="poker-table-panel__head">
          <h2 className="poker-table-panel__title">This Table</h2>
          <button type="button" className="secondary poker-table-panel__close" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="poker-table-panel__body">
          <section className="poker-table-panel__section">
            <h3 className="poker-table-panel__section-title">Players &amp; stacks</h3>
            <ul className="poker-table-panel__players">
              {seats.map((seat) => (
                <li key={seat.playerId} className="poker-table-panel__player">
                  <div className="poker-table-panel__player-head">
                    <span className="poker-table-panel__player-name">{seat.displayName}</span>
                    <span className="poker-table-panel__player-chips">
                      {seat.chipCount.toLocaleString()} chips
                    </span>
                  </div>
                  {canAddChips && onAddChips && (
                    <button
                      type="button"
                      className="secondary poker-table-panel__add-chips"
                      onClick={() => onAddChips(seat.playerId, ADD_CHIPS_AMOUNT)}
                    >
                      +{ADD_CHIPS_AMOUNT} chips
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isChallenge && !canAddChips && (
              <p className="poker-table-panel__hint">Challenge stacks are fixed after start.</p>
            )}
          </section>

          <section className="poker-table-panel__section poker-table-panel__actions">
            {showInvite && onInviteTable && (
              <button type="button" className="poker-table-panel__action" onClick={onInviteTable}>
                Invite to table
              </button>
            )}
            {canEditBlinds && onSaveBlinds && (
              <>
                <button
                  type="button"
                  className="poker-table-panel__action"
                  onClick={() => setShowBlindsEditor((value) => !value)}
                >
                  Edit blinds
                </button>
                {showBlindsEditor && (
                  <PokerBlindsControl
                    smallBlind={smallBlind}
                    bigBlind={bigBlind}
                    editable
                    hideLabel
                    onSave={(sb, bb) => {
                      onSaveBlinds(sb, bb);
                      setShowBlindsEditor(false);
                    }}
                  />
                )}
              </>
            )}
            {showShuffleDeck && onShuffleDeck && (
              <button type="button" className="poker-table-panel__action" onClick={onShuffleDeck}>
                Shuffle deck
              </button>
            )}
            {showStartHand && onStartHand && (
              <button type="button" className="poker-table-panel__action" onClick={onStartHand}>
                {startHandLabel}
              </button>
            )}
            {canResetTable && onBeginTableReset && (
              <button
                type="button"
                className="poker-table-panel__action"
                onClick={() => onBeginTableReset('resetTable')}
              >
                Reset table
              </button>
            )}
            {canResetTable && onBeginTableReset && isPractice && (
              <button
                type="button"
                className="poker-table-panel__action"
                onClick={() => onBeginTableReset('newGame')}
              >
                New game
              </button>
            )}
            {showEndChallenge && onEndChallenge && (
              <button type="button" className="poker-table-panel__action" onClick={onEndChallenge}>
                End challenge
              </button>
            )}
            {onLeaveTable && (
              <button
                type="button"
                className="poker-table-panel__action poker-table-panel__action--danger"
                onClick={onLeaveTable}
              >
                Leave table
              </button>
            )}
          </section>

          <section className="poker-table-panel__section">
            <h3 className="poker-table-panel__section-title">Action log</h3>
            <ul className="poker-table-panel__log">
              {actionLog.length === 0 ? (
                <li className="poker-table-panel__log-empty">No actions yet.</li>
              ) : (
                actionLog.slice(-12).map((entry, index) => (
                  // Append-only log: key on the global position so window
                  // shifts don't re-key repeated lines (e.g. "P checks").
                  <li key={`log-${Math.max(0, actionLog.length - 12) + index}`}>{entry}</li>
                ))
              )}
            </ul>
          </section>

          <section className="poker-table-panel__section">
            <h3 className="poker-table-panel__section-title">Chat</h3>
            <ul className="poker-table-panel__chat-list">
              {chatMessages.length === 0 ? (
                <li className="poker-table-panel__log-empty">No messages yet.</li>
              ) : (
                chatMessages.map((message) => (
                  <li key={message.id} className="poker-table-panel__chat-item">
                    <strong>{message.author}</strong>: {message.body}
                  </li>
                ))
              )}
            </ul>
            {onSendChat && (
              <form className="poker-table-panel__chat-form" onSubmit={handleChatSubmit}>
                <input
                  type="text"
                  className="poker-table-panel__chat-input"
                  placeholder="Say something at the table…"
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  maxLength={500}
                  disabled={chatSending}
                />
                <button type="submit" disabled={!chatDraft.trim() || chatSending}>
                  Send
                </button>
              </form>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
