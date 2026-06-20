import type { ZilchGameState } from '../../engine/dice/zilch';
import { canBank, canRollDice, isActiveZilchTurnPhase, isTurnoverRoll, mustKeepBeforeRoll } from '../../engine/dice/zilch';

interface ZilchActionsProps {
  zilch: ZilchGameState;
  rolling: boolean;
  controlsDisabled: boolean;
  onlineActionInFlight: boolean;
  hasPlayers: boolean;
  onRandomiseStarter: () => void;
  onRollDice: () => void;
  onBank: () => void;
  onQuitTurn: () => void;
}

export function ZilchActions({
  zilch,
  rolling,
  controlsDisabled,
  onlineActionInFlight,
  hasPlayers,
  onRandomiseStarter,
  onRollDice,
  onBank,
  onQuitTurn,
}: ZilchActionsProps) {
  const unkeptCount = zilch.dice.filter((d) => !d.isKept).length;
  const rollLabel = rolling
    ? 'Rolling…'
    : isTurnoverRoll(zilch)
      ? 'Roll all 6'
      : unkeptCount > 0 && unkeptCount < 6 && zilch.keptThisRoll
        ? `Roll ${unkeptCount} dice`
        : 'Roll';

  return (
    <div className="zilch-table__actions zilch-table__actions--stacked">
      {(zilch.phase === 'setup' ||
        (zilch.phase === 'randomising-starter' && !zilch.starterPlayerId)) && (
        <button
          type="button"
          onClick={onRandomiseStarter}
          disabled={onlineActionInFlight || !hasPlayers}
        >
          Randomise starter
        </button>
      )}
      {(isActiveZilchTurnPhase(zilch) || zilch.phase === 'awaiting-keep-selection') && (
        <>
          <button
            type="button"
            onClick={onRollDice}
            disabled={!canRollDice(zilch) || controlsDisabled || mustKeepBeforeRoll(zilch)}
          >
            {rollLabel}
          </button>
          <button type="button" onClick={onBank} disabled={!canBank(zilch) || controlsDisabled}>
            Bank points
          </button>
          <button
            type="button"
            className="secondary"
            onClick={onQuitTurn}
            disabled={!canBank(zilch) || controlsDisabled}
          >
            End turn
          </button>
        </>
      )}
    </div>
  );
}
