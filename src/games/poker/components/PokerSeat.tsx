import { PlayingCard } from '../../../components/PlayingCard';
import type { PokerSeatViewModel } from '../state/pokerTypes';

interface PokerSeatProps {
  seat: PokerSeatViewModel;
}

function seatBadges(seat: PokerSeatViewModel): Array<{ key: string; label: string; className: string }> {
  const badges: Array<{ key: string; label: string; className: string }> = [];
  if (seat.isDealer) {
    badges.push({ key: 'd', label: 'D', className: 'poker-seat__dealer-badge' });
  }
  if (seat.isSmallBlind) {
    badges.push({ key: 'sb', label: 'SB', className: 'poker-seat__role-badge' });
  }
  if (seat.isBigBlind) {
    badges.push({ key: 'bb', label: 'BB', className: 'poker-seat__role-badge' });
  }
  if (seat.isAllIn) {
    badges.push({ key: 'ai', label: 'ALL IN', className: 'poker-seat__all-in-badge' });
  }
  if (seat.isWinner) {
    badges.push({ key: 'win', label: 'WIN', className: 'poker-seat__winner-badge' });
  }
  return badges;
}

export function PokerSeat({ seat }: PokerSeatProps) {
  const badges = seatBadges(seat);

  return (
    <article
      className={[
        'poker-seat',
        seat.isActive ? 'poker-seat--active' : '',
        seat.isFolded ? 'poker-seat--folded' : '',
        seat.isAllIn ? 'poker-seat--all-in' : '',
        seat.isWinner ? 'poker-seat--winner' : '',
        seat.isViewer ? 'poker-seat--viewer' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-player-id={seat.playerId}
      data-testid={`poker-seat-${seat.playerId}`}
    >
      <header className="poker-seat__head">
        <span className="poker-seat__name">{seat.displayName}</span>
        {badges.length > 0 && (
          <span className="poker-seat__badges" aria-label="Seat markers">
            {badges.map((badge) => (
              <span key={badge.key} className={badge.className}>
                {badge.label}
              </span>
            ))}
          </span>
        )}
      </header>

      <p className="poker-seat__chips">
        {seat.chipCount.toLocaleString()} chips
        {seat.streetBet > 0 && (
          <span className="poker-seat__street-bet"> · bet {seat.streetBet}</span>
        )}
      </p>

      {seat.holeCards && seat.holeCards.cards.length > 0 && (
        <div className="poker-seat__cards" aria-label={seat.holeCards.faceDown ? 'Hidden hole cards' : 'Hole cards'}>
          {seat.holeCards.cards.map((card) => (
            <PlayingCard
              key={card.id}
              card={card}
              compact
              faceDown={seat.holeCards?.faceDown}
              animationMode="slide"
            />
          ))}
        </div>
      )}

      <footer className="poker-seat__status">{seat.actionStatus}</footer>
    </article>
  );
}
