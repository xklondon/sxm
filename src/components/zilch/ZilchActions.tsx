import type { ZilchGameState } from '../../engine/dice/zilch';
import { canBank, canInitialRollAllDice, canRollAvailableDice } from '../../engine/dice/zilch';

interface ZilchActionsProps {
  zilch: ZilchGameState;
  rolling: boolean;
  controlsDisabled: boolean;
  canKeepAndRoll: boolean;
  onKeepAndRoll: () => void;
  onRollDice: () => void;
  onBank: () => void;
}

export function ZilchActions({
  zilch,
  rolling,
  controlsDisabled,
  canKeepAndRoll,
  onKeepAndRoll,
  onRollDice,
  onBank,
}: ZilchActionsProps) {
  const showPlayActions =
    zilch.phase === 'player-turn' ||
    zilch.phase === 'final-round' ||
    zilch.phase === 'awaiting-keep-selection';

  if (!showPlayActions) {
    return null;
  }

  const initialRoll = canInitialRollAllDice(zilch);
  const rollAvailable = canRollAvailableDice(zilch);
  const rollAllLabel = rolling
    ? 'Rolling…'
    : initialRoll
      ? 'Roll all dice'
      : rollAvailable
        ? `Roll ${zilch.dice.filter((d) => !d.isKept).length || 6} dice`
        : 'Roll available dice';

  return (
    <div className="zilch-table__actions zilch-table__actions--compact">
      {zilch.phase === 'awaiting-keep-selection' && (
        <button
          type="button"
          className="zilch-table__action-btn"
          onClick={onKeepAndRoll}
          disabled={!canKeepAndRoll || controlsDisabled}
        >
          Keep and roll
        </button>
      )}
      <button
        type="button"
        className="zilch-table__action-btn"
        onClick={onRollDice}
        disabled={controlsDisabled || rolling || !(initialRoll || rollAvailable)}
      >
        {rollAllLabel}
      </button>
      <button
        type="button"
        className="zilch-table__action-btn"
        onClick={onBank}
        disabled={!canBank(zilch) || controlsDisabled}
      >
        Bank
      </button>
    </div>
  );
}
