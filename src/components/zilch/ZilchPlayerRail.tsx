import type { GameState } from '../../types';
import type { ZilchGameState } from '../../engine/dice/zilch';
import {
  distributeZilchSeats,
  playerBoxStatus,
  resolveZilchSeatDisplay,
  statusLabel,
} from '../zilchPlayerDisplay';

interface ZilchPlayerRailProps {
  gameState: GameState;
  zilch: ZilchGameState | null;
  playerOrder: string[];
}

function renderSeat(
  gameState: GameState,
  zilch: ZilchGameState | null,
  id: string,
) {
  const { name, boxLabel, isVirtual } = resolveZilchSeatDisplay(gameState, id);
  const status = playerBoxStatus(id, zilch);
  const isActive = zilch?.currentPlayerId === id;
  const total = zilch?.totalScoresByPlayerId[id] ?? 0;
  const showTurnScore = isActive && zilch && zilch.turnScore > 0;

  return (
    <div
      key={id}
      className={`zilch-seat${
        isActive ? ' zilch-seat--active' : ''
      }${status === 'zilch' ? ' zilch-seat--zilch' : ''}${
        status === 'winner' ? ' zilch-seat--winner' : ''
      }`}
    >
      <div className="zilch-seat__name" title={name}>
        {name}
      </div>
      {boxLabel && (
        <div className="zilch-seat__box" title={boxLabel}>
          {boxLabel}
        </div>
      )}
      {isVirtual && (
        <span className="zilch-seat__badge zilch-seat__badge--virtual">Virtual</span>
      )}
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
}

function SeatColumn({
  className,
  indices,
  gameState,
  zilch,
  playerOrder,
}: {
  className: string;
  indices: number[];
  gameState: GameState;
  zilch: ZilchGameState | null;
  playerOrder: string[];
}) {
  if (indices.length === 0) {
    return null;
  }
  return (
    <div className={className}>
      {indices.map((index) => {
        const id = playerOrder[index];
        if (!id) {
          return null;
        }
        return renderSeat(gameState, zilch, id);
      })}
    </div>
  );
}

export function ZilchPlayerRail({ gameState, zilch, playerOrder }: ZilchPlayerRailProps) {
  const ring = distributeZilchSeats(playerOrder.length);

  return (
    <div className="zilch-table__seat-ring" data-player-count={Math.min(playerOrder.length, 6)}>
      <SeatColumn
        className="zilch-table__seats zilch-table__seats--top"
        indices={ring.top}
        gameState={gameState}
        zilch={zilch}
        playerOrder={playerOrder}
      />
      <SeatColumn
        className="zilch-table__seats zilch-table__seats--left"
        indices={ring.left}
        gameState={gameState}
        zilch={zilch}
        playerOrder={playerOrder}
      />
      <SeatColumn
        className="zilch-table__seats zilch-table__seats--right"
        indices={ring.right}
        gameState={gameState}
        zilch={zilch}
        playerOrder={playerOrder}
      />
      <SeatColumn
        className="zilch-table__seats zilch-table__seats--bottom"
        indices={ring.bottom}
        gameState={gameState}
        zilch={zilch}
        playerOrder={playerOrder}
      />
    </div>
  );
}
