import { PokerSeat } from './PokerSeat';
import { POKER_TEMPLATE_SEAT_RING } from '../pokerTemplateContract';
import { POKER0_SEAT_CELL } from '../poker0LayoutContract';
import { poker0SeatGridArea } from '../poker0SeatLayout';
import { rotateSeatsForViewer } from '../state/pokerTypes';
import type { PokerSeatViewModel } from '../state/pokerTypes';

interface PokerSeatRingProps {
  seats: PokerSeatViewModel[];
}

export function PokerSeatRing({ seats }: PokerSeatRingProps) {
  const orderedSeats = rotateSeatsForViewer(seats);
  const seatCount = orderedSeats.length;

  return (
    <div
      className={`poker-seat-ring ${POKER_TEMPLATE_SEAT_RING}`}
      data-seat-count={seatCount}
      aria-label="Player seats"
    >
      {orderedSeats.map((seat) => (
        <div
          key={seat.playerId}
          className={`poker-seat-ring__slot ${POKER0_SEAT_CELL}`}
          style={{ gridArea: poker0SeatGridArea(seat.seatIndex, seatCount) }}
        >
          <PokerSeat seat={seat} />
        </div>
      ))}
    </div>
  );
}
