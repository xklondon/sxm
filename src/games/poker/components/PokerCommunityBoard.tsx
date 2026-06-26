import { PlayingCard } from '../../../components/PlayingCard';
import type { Card } from '../../../types/deck';
import type { PokerStreet } from '../state/pokerTypes';

interface PokerCommunityBoardProps {
  street: PokerStreet;
  communityCards: Card[];
  handActive?: boolean;
}

const STREET_LABEL: Partial<Record<PokerStreet, string>> = {
  preflop: 'Pre-flop betting',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
  resolved: 'Hand complete',
};

export function PokerCommunityBoard({
  street,
  communityCards,
  handActive = false,
}: PokerCommunityBoardProps) {
  const streetLabel = STREET_LABEL[street];
  const showStreet = handActive && streetLabel;

  return (
    <section className="poker-community" aria-label="Community board">
      {showStreet && <p className="poker-community__street">{streetLabel}</p>}
      <div className="poker-community__cards">
        {communityCards.length === 0 ? (
          handActive && street !== 'preflop' ? (
            <span className="poker-community__placeholder">Waiting for the flop</span>
          ) : null
        ) : (
          communityCards.map((card) => (
            <PlayingCard key={card.id} card={card} compact animationMode="slide" />
          ))
        )}
      </div>
    </section>
  );
}
