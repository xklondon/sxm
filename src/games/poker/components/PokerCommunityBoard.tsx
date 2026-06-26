import { PlayingCard } from '../../../components/PlayingCard';
import type { Card } from '../../../types/deck';
import type { PokerStreet } from '../state/pokerTypes';
import { POKER0_COMMUNITY } from '../poker0LayoutContract';

interface PokerCommunityBoardProps {
  street: PokerStreet;
  communityCards: Card[];
  handActive?: boolean;
}

function StreetRow({
  label,
  cards,
  placeholder,
}: {
  label: string;
  cards: Card[];
  placeholder?: string;
}) {
  return (
    <div className="poker0-community__street" data-testid={`poker-community-${label.toLowerCase()}`}>
      <span className="poker0-community__label">{label}</span>
      <div className="poker0-community__cards">
        {cards.length === 0 ? (
          placeholder ? <span className="poker0-community__placeholder">{placeholder}</span> : null
        ) : (
          cards.map((card) => (
            <PlayingCard key={card.id} card={card} compact animationMode="slide" />
          ))
        )}
      </div>
    </div>
  );
}

export function PokerCommunityBoard({
  street,
  communityCards,
  handActive = false,
}: PokerCommunityBoardProps) {
  const flop = communityCards.slice(0, 3);
  const turn = communityCards.slice(3, 4);
  const river = communityCards.slice(4, 5);
  const waitingFlop = handActive && street !== 'preflop' && flop.length === 0;

  return (
    <section className={`poker-community ${POKER0_COMMUNITY}`} aria-label="Community board">
      <StreetRow
        label="FLOP"
        cards={flop}
        placeholder={waitingFlop ? '—' : undefined}
      />
      <StreetRow label="TURN" cards={turn} />
      <StreetRow label="RIVER" cards={river} />
    </section>
  );
}
