import type { GameState } from '../../types';
import type { ZilchGameState } from '../../engine/dice/zilch';
import { playerBoxStatus, seatPositionClass, statusLabel } from '../zilchPlayerDisplay';

interface ZilchPlayerRailProps {
  gameState: GameState;
  zilch: ZilchGameState | null;
  playerOrder: string[];
}

export function ZilchPlayerRail({ gameState, zilch, playerOrder }: ZilchPlayerRailProps) {
  const { players } = gameState;

  return (
    <>
      {playerOrder.map((id, index) => {
        const player = players[id];
        const status = playerBoxStatus(id, zilch);
        const isActive = zilch?.currentPlayerId === id;
        const total = zilch?.totalScoresByPlayerId[id] ?? 0;
        const showTurnScore = isActive && zilch && zilch.turnScore > 0;
        return (
          <div
            key={id}
            className={`zilch-seat ${seatPositionClass(index, playerOrder.length)}${
              isActive ? ' zilch-seat--active' : ''
            }${status === 'zilch' ? ' zilch-seat--zilch' : ''}${
              status === 'winner' ? ' zilch-seat--winner' : ''
            }`}
          >
            <div className="zilch-seat__name">
              {player?.displayName ?? id}
              {player?.playerType === 'virtual' && (
                <span className="zilch-seat__badge zilch-seat__badge--virtual">Virtual</span>
              )}
            </div>
            <div className="zilch-seat__score">Total: {total}</div>
            {showTurnScore && (
              <div className="zilch-seat__turn-score">Turn: {zilch!.turnScore}</div>
            )}
            <div
              className={`zilch-seat__status${
                status === 'turn' ? ' zilch-seat__status--turn' : ''
              }${status === 'zilch' ? ' zilch-seat__status--zilch' : ''}`}
            >
              {statusLabel(status)}
            </div>
          </div>
        );
      })}
    </>
  );
}
