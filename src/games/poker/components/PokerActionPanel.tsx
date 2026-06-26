import { useEffect, useMemo, useState } from 'react';
import { POKER_TEMPLATE_ACTION_BAR } from '../pokerTemplateContract';
import type { PokerActionAvailability, PokerPlayerAction } from '../state/pokerTypes';

interface PokerActionPanelProps {
  activePlayerName: string | null;
  availability: PokerActionAvailability;
  pot?: number;
  bigBlind?: number;
  disabled?: boolean;
  onAction?: (action: PokerPlayerAction, amount?: number) => void;
}

function chipPresets(availability: PokerActionAvailability, pot: number, bigBlind: number): number[] {
  const base = Math.max(bigBlind, availability.minBet, 1);
  const presets = [base, base * 2, base * 3];
  if (pot > 0) {
    presets.push(Math.max(base, Math.floor(pot / 2)), Math.max(base, pot));
  }
  return [...new Set(presets.filter((value) => value > 0))].slice(0, 5);
}

export function PokerActionPanel({
  activePlayerName,
  availability,
  pot = 0,
  bigBlind = 10,
  disabled = false,
  onAction,
}: PokerActionPanelProps) {
  const defaultAmount = availability.minRaise || availability.minBet || bigBlind;
  const [betInput, setBetInput] = useState(String(defaultAmount));
  const presets = useMemo(() => chipPresets(availability, pot, bigBlind), [availability, pot, bigBlind]);

  useEffect(() => {
    setBetInput(String(defaultAmount));
  }, [defaultAmount, activePlayerName]);

  if (!activePlayerName) {
    return (
      <section className={`poker-actions poker-actions--idle ${POKER_TEMPLATE_ACTION_BAR}`} aria-label="Player actions">
        <p className="poker-hr-action-bar__hint">Waiting for the next hand.</p>
      </section>
    );
  }

  const betAmount = Number.parseInt(betInput, 10) || defaultAmount;

  function dispatch(action: PokerPlayerAction, amount?: number) {
    if (disabled || !onAction) {
      return;
    }
    if (action === 'bet' || action === 'raise') {
      onAction(action, amount ?? betAmount);
      return;
    }
    onAction(action);
  }

  const primaryAction = availability.canRaise ? 'raise' : availability.canBet ? 'bet' : null;
  const primaryLabel = availability.canRaise ? 'Raise' : availability.canBet ? 'Bet' : 'Bet';
  const callLabel =
    availability.canCall && availability.callAmount > 0
      ? `Call ${availability.callAmount}`
      : 'Call';

  return (
    <section className={`poker-actions ${POKER_TEMPLATE_ACTION_BAR}`} aria-label="Player actions">
      <p className="poker-hr-action-bar__turn">
        <span className="poker-hr-action-bar__turn-label">Acting</span>
        {activePlayerName}
      </p>

      <div className="poker-hr-action-bar__chips" role="group" aria-label="Bet amounts">
        {presets.map((amount) => (
          <button
            key={amount}
            type="button"
            className={`poker-hr-chip-btn${betAmount === amount ? ' poker-hr-chip-btn--active' : ''}`}
            disabled={disabled || (!availability.canBet && !availability.canRaise)}
            onClick={() => {
              setBetInput(String(amount));
              if (primaryAction) {
                dispatch(primaryAction, amount);
              }
            }}
          >
            {amount}
          </button>
        ))}
      </div>

      <label className="poker-hr-action-bar__amount">
        <span className="poker-hr-action-bar__amount-label">Amount</span>
        <input
          type="number"
          min={availability.minBet}
          className="poker-hr-action-bar__amount-input"
          value={betInput}
          disabled={disabled}
          onChange={(event) => setBetInput(event.target.value)}
        />
      </label>

      <div className="poker-hr-action-bar__buttons">
        <button
          type="button"
          className="poker-hr-btn poker-hr-btn--fold"
          disabled={disabled || !availability.canFold}
          onClick={() => dispatch('fold')}
        >
          Fold
        </button>
        <button
          type="button"
          className="poker-hr-btn poker-hr-btn--check"
          disabled={disabled || (!availability.canCheck && !availability.canCall)}
          onClick={() => dispatch(availability.canCheck ? 'check' : 'call')}
        >
          {availability.canCheck ? 'Check' : callLabel}
        </button>
        {primaryAction && (
          <button
            type="button"
            className="poker-hr-btn poker-hr-btn--bet"
            disabled={disabled}
            onClick={() => dispatch(primaryAction, betAmount)}
          >
            {primaryLabel} {betAmount}
          </button>
        )}
        <button
          type="button"
          className="poker-hr-btn poker-hr-btn--all-in"
          disabled={disabled || !availability.canAllIn}
          title={availability.allInDisabledReason}
          onClick={() => dispatch('all-in')}
        >
          All In{availability.allInAmount > 0 ? ` ${availability.allInAmount}` : ''}
        </button>
      </div>
    </section>
  );
}
