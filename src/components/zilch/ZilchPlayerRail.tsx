import type { ZilchVisiblePlayer } from '../../engine/dice/zilch/zilchVisiblePlayers';
import type { ZilchGameState } from '../../engine/dice/zilch';
import { distributeZilchSeats, playerBoxStatus, statusLabel } from '../zilchPlayerDisplay';

interface ZilchPlayerRailProps {
  zilch: ZilchGameState | null;
  visiblePlayers: ZilchVisiblePlayer[];
  highlightPlayerId?: string | null;
}

function renderSeat(
  player: ZilchVisiblePlayer,
  zilch: ZilchGameState | null,
  highlightPlayerId?: string | null,
) {
  const { playerId, name, boxLabel, isVirtual } = player;
  const status = playerBoxStatus(playerId, zilch);
  const isActive = zilch?.currentPlayerId === playerId;
  const isHighlighted = highlightPlayerId === playerId;
  const total = zilch?.totalScoresByPlayerId[playerId] ?? 0;
  const showTurnScore = isActive && zilch && zilch.turnScore > 0;

  return (
    <div
      key={playerId}
      data-testid={`zilch-seat-${playerId}`}
      data-player-id={playerId}
      data-active={isActive ? 'true' : 'false'}
      className={`zilch-seat${
        isActive ? ' zilch-seat--active' : ''
      }${isHighlighted ? ' zilch-seat--highlight' : ''}${
        status === 'zilch' ? ' zilch-seat--zilch' : ''
      }${status === 'winner' ? ' zilch-seat--winner' : ''}`}
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
  visiblePlayers,
  zilch,
  highlightPlayerId,
}: {
  className: string;
  indices: number[];
  visiblePlayers: ZilchVisiblePlayer[];
  zilch: ZilchGameState | null;
  highlightPlayerId?: string | null;
}) {
  if (indices.length === 0) {
    return null;
  }
  return (
    <div className={className}>
      {indices.map((index) => {
        const player = visiblePlayers[index];
        if (!player) {
          return null;
        }
        return renderSeat(player, zilch, highlightPlayerId);
      })}
    </div>
  );
}

export function ZilchPlayerRail({
  zilch,
  visiblePlayers,
  highlightPlayerId = null,
}: ZilchPlayerRailProps) {
  const ring = distributeZilchSeats(visiblePlayers.length);

  return (
    <div className="zilch-table__seat-ring" data-player-count={visiblePlayers.length}>
      <SeatColumn
        className="zilch-table__seats zilch-table__seats--top"
        indices={ring.top}
        visiblePlayers={visiblePlayers}
        zilch={zilch}
        highlightPlayerId={highlightPlayerId}
      />
      <SeatColumn
        className="zilch-table__seats zilch-table__seats--left"
        indices={ring.left}
        visiblePlayers={visiblePlayers}
        zilch={zilch}
        highlightPlayerId={highlightPlayerId}
      />
      <SeatColumn
        className="zilch-table__seats zilch-table__seats--right"
        indices={ring.right}
        visiblePlayers={visiblePlayers}
        zilch={zilch}
        highlightPlayerId={highlightPlayerId}
      />
      <SeatColumn
        className="zilch-table__seats zilch-table__seats--bottom"
        indices={ring.bottom}
        visiblePlayers={visiblePlayers}
        zilch={zilch}
        highlightPlayerId={highlightPlayerId}
      />
    </div>
  );
}
