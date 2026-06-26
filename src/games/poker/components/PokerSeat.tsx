import { PlayingCard } from '../../../components/PlayingCard';
import type { PokerSeatViewModel } from '../state/pokerTypes';

interface PokerSeatProps {
  seat: PokerSeatViewModel;
}

function seatInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function seatBadges(seat: PokerSeatViewModel): Array<{ key: string; label: string; className: string }> {
  const badges: Array<{ key: string; label: string; className: string }> = [];
  if (seat.isDealer) {
    badges.push({ key: 'd', label: 'D', className: 'poker-hr-seat__badge poker-hr-seat__badge--dealer' });
  }
  if (seat.isSmallBlind) {
    badges.push({ key: 'sb', label: 'SB', className: 'poker-hr-seat__badge poker-hr-seat__badge--role' });
  }
  if (seat.isBigBlind) {
    badges.push({ key: 'bb', label: 'BB', className: 'poker-hr-seat__badge poker-hr-seat__badge--role' });
  }
  if (seat.isAllIn) {
    badges.push({ key: 'ai', label: 'ALL IN', className: 'poker-hr-seat__badge poker-hr-seat__badge--all-in' });
  }
  if (seat.isWinner) {
    badges.push({ key: 'win', label: 'WIN', className: 'poker-hr-seat__badge poker-hr-seat__badge--winner' });
  }
  return badges;
}

export function PokerSeat({ seat }: PokerSeatProps) {
  const badges = seatBadges(seat);

  return (
    <article
      className={[
        'poker-seat',
        'poker-hr-seat',
        seat.isActive ? 'poker-seat--active poker-hr-seat--active' : '',
        seat.isFolded ? 'poker-seat--folded poker-hr-seat--folded' : '',
        seat.isAllIn ? 'poker-seat--all-in poker-hr-seat--all-in' : '',
        seat.isWinner ? 'poker-seat--winner poker-hr-seat--winner' : '',
        seat.isViewer ? 'poker-seat--viewer poker-hr-seat--viewer' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-player-id={seat.playerId}
      data-testid={`poker-seat-${seat.playerId}`}
    >
      <div className="poker-hr-seat__avatar" aria-hidden="true">
        {seatInitials(seat.displayName)}
      </div>

      <header className="poker-seat__head poker-hr-seat__head">
        <span className="poker-seat__name poker-hr-seat__name">{seat.displayName}</span>
        {badges.length > 0 && (
          <span className="poker-seat__badges poker-hr-seat__badges" aria-label="Seat markers">
            {badges.map((badge) => (
              <span key={badge.key} className={badge.className}>
                {badge.label}
              </span>
            ))}
          </span>
        )}
      </header>

      <p className="poker-seat__chips poker-hr-seat__stack">
        {seat.chipCount.toLocaleString()}
        {seat.streetBet > 0 && (
          <span className="poker-seat__street-bet"> · {seat.streetBet}</span>
        )}
      </p>

      {seat.holeCards && seat.holeCards.cards.length > 0 && (
        <div className="poker-seat__cards poker-hr-seat__cards" aria-label={seat.holeCards.faceDown ? 'Hidden hole cards' : 'Hole cards'}>
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
    </article>
  );
}
