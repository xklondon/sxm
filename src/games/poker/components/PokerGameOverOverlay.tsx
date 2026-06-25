import { useState } from 'react';
import type { PokerWinnerTakesAllSettlement } from '../state/pokerChallengeSettlement';
import type { GameOverIouFeedback } from '../../../components/GameOverActionOverlay';
import './PokerGameOverOverlay.css';

export interface PokerGameOverOverlayProps {
  open: boolean;
  settlement: PokerWinnerTakesAllSettlement | null;
  isChallenge: boolean;
  iouFeedback?: GameOverIouFeedback | null;
  iouPending?: boolean;
  pending?: boolean;
  canStartNewGame?: boolean;
  newGameDisabledReason?: string;
  onSendIous?: () => void | Promise<void>;
  onNewHand?: () => void;
  onExitTable?: () => void;
  onDismiss?: () => void;
}

export function PokerGameOverOverlay({
  open,
  settlement,
  isChallenge,
  iouFeedback = null,
  iouPending = false,
  pending = false,
  canStartNewGame = true,
  newGameDisabledReason,
  onSendIous,
  onNewHand,
  onExitTable,
  onDismiss,
}: PokerGameOverOverlayProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!open || !settlement) {
    return null;
  }

  const busy = pending || iouPending;
  const showSendIous = isChallenge && Boolean(onSendIous);
  const startNewGameDisabled = !canStartNewGame || busy;

  return (
    <div className="poker-game-over" role="dialog" aria-modal="true" aria-label="Game over">
      <div className="poker-game-over__panel">
        <header className="poker-game-over__header">
          <h2>{isChallenge ? 'Challenge ended' : 'Hand complete'}</h2>
          <button type="button" className="secondary" onClick={() => setCollapsed((v) => !v)}>
            {collapsed ? 'Show details' : 'Hide'}
          </button>
        </header>

        {!collapsed && (
          <>
            <p className="poker-game-over__winner">
              Winner: <strong>{settlement.winnerName}</strong>
            </p>
            <dl className="poker-game-over__summary">
              <div>
                <dt>Total challenge value</dt>
                <dd>
                  {settlement.currency}
                  {settlement.totalChallengeValue}
                </dd>
              </div>
              <div>
                <dt>Participants</dt>
                <dd>{settlement.participantCount}</dd>
              </div>
              <div>
                <dt>Stake per participant</dt>
                <dd>
                  {settlement.currency}
                  {settlement.stakePerParticipant.toFixed(2)}
                </dd>
              </div>
            </dl>
            {settlement.blockingReason && (
              <p className="poker-game-over__feedback poker-game-over__feedback--error" role="alert">
                {settlement.blockingReason}
              </p>
            )}
            {settlement.losers.length > 0 && (
              <section>
                <h3>IOU recipients (losers)</h3>
                <ul className="poker-game-over__losers">
                  {settlement.losers.map((loser) => (
                    <li key={loser.playerId}>
                      {loser.displayName}
                      {loser.email ? ` (${loser.email})` : ' — missing email'}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {iouFeedback && (
              <p
                className={`poker-game-over__feedback poker-game-over__feedback--${iouFeedback.tone}`}
                role="status"
              >
                {iouFeedback.message}
              </p>
            )}
          </>
        )}

        <div className="poker-game-over__actions">
          {showSendIous && (
            <button type="button" disabled={busy} onClick={() => void onSendIous?.()}>
              Send IOUs
            </button>
          )}
          <button type="button" disabled={startNewGameDisabled} onClick={onNewHand}>
            New Hand / New Game
          </button>
          {newGameDisabledReason && (
            <p className="poker-game-over__hint" role="status">
              {newGameDisabledReason}
            </p>
          )}
          <button type="button" className="secondary" disabled={busy} onClick={onExitTable}>
            Exit Table
          </button>
          {onDismiss && (
            <button type="button" className="secondary" disabled={busy} onClick={onDismiss}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
