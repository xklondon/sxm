import type { ZilchGameState } from '../../engine/dice/zilch';
import { canBank, canRollDice } from '../../engine/dice/zilch';

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
  return (
    <div className="zilch-table__actions">
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
      {(zilch.phase === 'player-turn' || zilch.phase === 'awaiting-keep-selection') && (
        <>
          <button
            type="button"
            onClick={onRollDice}
            disabled={!canRollDice(zilch) || controlsDisabled}
          >
            {rolling ? 'Rolling…' : 'Roll'}
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
