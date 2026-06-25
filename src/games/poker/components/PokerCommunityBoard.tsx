import { PlayingCard } from '../../../components/PlayingCard';
import type { Card } from '../../../types/deck';
import type { PokerStreet } from '../state/pokerTypes';

interface PokerCommunityBoardProps {
  street: PokerStreet;
  communityCards: Card[];
}

const STREET_LABEL: Record<PokerStreet, string> = {
  setup: 'Setup',
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
  resolved: 'Hand complete',
};

export function PokerCommunityBoard({ street, communityCards }: PokerCommunityBoardProps) {
  return (
    <section className="poker-community" aria-label="Community board">
      <p className="poker-community__street">{STREET_LABEL[street]}</p>
      <div className="poker-community__cards">
        {communityCards.length === 0 ? (
          <span className="poker-community__placeholder">Waiting for the flop</span>
        ) : (
          communityCards.map((card) => (
            <PlayingCard key={card.id} card={card} compact animationMode="slide" />
          ))
        )}
      </div>
    </section>
  );
}
