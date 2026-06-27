import type { ZilchGameState } from '../../engine/dice/zilch';
import { canBank, canInitialRollAllDice, canRollAvailableDice } from '../../engine/dice/zilch';

interface ZilchPlayControlsProps {
  zilch: ZilchGameState;
  rolling: boolean;
  controlsDisabled: boolean;
  canKeepSelected: boolean;
  diceUiPhase: 'idle' | 'rolling' | 'landed' | 'ordered';
  actionError?: string | null;
  onKeepSelected: () => void;
  onRollDice: () => void;
  onBank: () => void;
}

export function ZilchPlayControls({
  zilch,
  rolling,
  controlsDisabled,
  canKeepSelected,
  diceUiPhase,
  actionError = null,
  onKeepSelected,
  onRollDice,
  onBank,
}: ZilchPlayControlsProps) {
  const showPlayActions =
    zilch.phase === 'player-turn' ||
    zilch.phase === 'final-round' ||
    zilch.phase === 'awaiting-keep-selection';

  if (!showPlayActions) {
    return null;
  }

  const initialRoll = canInitialRollAllDice(zilch);
  const rollAvailable = canRollAvailableDice(zilch);
  const selectionPhase = zilch.phase === 'awaiting-keep-selection';
  const rollDisabled =
    controlsDisabled ||
    rolling ||
    diceUiPhase === 'landed' ||
    !(initialRoll || rollAvailable);
  const keepDisabled =
    controlsDisabled || !canKeepSelected || diceUiPhase !== 'ordered' || !selectionPhase;

  const roundLabel =
    zilch.mode === 'fixed_rounds' && zilch.roundLimit
      ? `Round ${zilch.currentRound} / ${zilch.roundLimit}`
      : `Round ${zilch.currentRound}`;
  const targetLabel =
    zilch.mode === 'target_points' && zilch.targetPoints
      ? `Target ${zilch.targetPoints.toLocaleString()}`
      : zilch.roundLimit
        ? `${zilch.roundLimit} rounds`
        : '—';

  return (
    <div className="zilch-table__control-row" data-testid="zilch-control-row">
      {actionError && (
        <p className="zilch-table__inline-error" role="alert">
          {actionError}
        </p>
      )}
      <div className="zilch-table__info-block" aria-label="Round and target">
        <span className="zilch-table__info-line">{roundLabel}</span>
        <span className="zilch-table__info-line zilch-table__info-line--muted">{targetLabel}</span>
      </div>

      <div className="zilch-table__actions zilch-table__actions--compact">
        {selectionPhase && (
          <button
            type="button"
            className="zilch-table__action-btn zilch-table__action-btn--keep"
            onClick={onKeepSelected}
            disabled={keepDisabled}
          >
            Keep selected
          </button>
        )}
        <button
          type="button"
          className="zilch-table__action-btn zilch-table__action-btn--roll"
          onClick={onRollDice}
          disabled={rollDisabled}
        >
          {rolling ? 'Rolling…' : 'Roll Dice'}
        </button>
        <button
          type="button"
          className="zilch-table__action-btn zilch-table__action-btn--bank"
          onClick={onBank}
          disabled={!canBank(zilch) || controlsDisabled || diceUiPhase === 'landed'}
        >
          Bank
        </button>
      </div>

      <div className="zilch-table__info-block zilch-table__info-block--turn" aria-label="Turn score">
        <span className="zilch-table__info-line">Turn score</span>
        <span className="zilch-table__info-line zilch-table__info-line--score">{zilch.turnScore}</span>
      </div>
    </div>
  );
}
