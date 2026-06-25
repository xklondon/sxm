import { PokerSeat } from './PokerSeat';
import { pokerSeatPosition, rotateSeatsForViewer } from '../state/pokerTypes';
import type { PokerSeatViewModel } from '../state/pokerTypes';

interface PokerSeatRingProps {
  seats: PokerSeatViewModel[];
}

export function PokerSeatRing({ seats }: PokerSeatRingProps) {
  const orderedSeats = rotateSeatsForViewer(seats);

  return (
    <div className="poker-seat-ring" aria-label="Player seats">
      {orderedSeats.map((seat) => {
        const position = pokerSeatPosition(seat.seatIndex, orderedSeats.length);
        return (
          <div
            key={seat.playerId}
            className="poker-seat-ring__slot"
            style={{ left: position.left, top: position.top }}
          >
            <PokerSeat seat={seat} />
          </div>
        );
      })}
    </div>
  );
}
