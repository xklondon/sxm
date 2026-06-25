import { useState } from 'react';
import type { PokerActionAvailability, PokerPlayerAction } from '../state/pokerTypes';

interface PokerActionPanelProps {
  activePlayerName: string | null;
  availability: PokerActionAvailability;
  disabled?: boolean;
  onAction?: (action: PokerPlayerAction, amount?: number) => void;
}

export function PokerActionPanel({
  activePlayerName,
  availability,
  disabled = false,
  onAction,
}: PokerActionPanelProps) {
  const [betInput, setBetInput] = useState(String(availability.minRaise));

  if (!activePlayerName) {
    return (
      <section className="poker-actions poker-actions--idle" aria-label="Player actions">
        <p className="poker-actions__prompt">Waiting for the next hand.</p>
      </section>
    );
  }

  const betAmount = Number.parseInt(betInput, 10) || 0;

  function dispatch(action: PokerPlayerAction) {
    if (disabled || !onAction) {
      return;
    }
    if (action === 'bet' || action === 'raise') {
      onAction(action, betAmount);
      return;
    }
    onAction(action);
  }

  return (
    <section className="poker-actions" aria-label="Player actions">
      <p className="poker-actions__prompt">{activePlayerName}&apos;s turn</p>

      <label className="poker-actions__bet-label">
        Bet / raise
        <input
          type="number"
          min={availability.minBet}
          className="poker-actions__bet-input"
          value={betInput}
          disabled={disabled}
          onChange={(event) => setBetInput(event.target.value)}
        />
      </label>

      <div className="poker-actions__buttons">
        <button type="button" disabled={disabled || !availability.canCheck} onClick={() => dispatch('check')}>
          Check
        </button>
        <button type="button" disabled={disabled || !availability.canCall} onClick={() => dispatch('call')}>
          Call {availability.callAmount > 0 ? availability.callAmount : ''}
        </button>
        <button type="button" disabled={disabled || !availability.canBet} onClick={() => dispatch('bet')}>
          Bet
        </button>
        <button type="button" disabled={disabled || !availability.canRaise} onClick={() => dispatch('raise')}>
          Raise
        </button>
        <button
          type="button"
          className="poker-actions__all-in"
          disabled={disabled || !availability.canAllIn}
          title={availability.allInDisabledReason}
          onClick={() => dispatch('all-in')}
        >
          All In {availability.allInAmount > 0 ? availability.allInAmount : ''}
        </button>
        <button type="button" className="secondary" disabled={disabled || !availability.canFold} onClick={() => dispatch('fold')}>
          Fold
        </button>
      </div>
    </section>
  );
}
