import { memo } from 'react';
import type { Card } from '../types/deck';
import type { DealAnimationMode } from '../engine/deck/dealAnimation';
import { getDealAnimationClass } from '../engine/deck/dealAnimation';
import {
  isFaceRank,
  isPipRank,
  isRedSuit,
  PIP_LAYOUTS,
  SUIT_SYMBOLS,
} from './cardDisplay';
import './PlayingCard.css';

interface PlayingCardProps {
  card: Card;
  compact?: boolean;
  faceDown?: boolean;
  animationMode?: DealAnimationMode;
  className?: string;
}

function CardFace({ card }: { card: Card }) {
  const suit = SUIT_SYMBOLS[card.suit];

  return (
    <>
      <div className="playing-card__corner playing-card__corner--tl">
        <span className="playing-card__rank">{card.rank}</span>
        <span className="playing-card__suit-sm">{suit}</span>
      </div>
      <div className="playing-card__corner playing-card__corner--br">
        <span className="playing-card__rank">{card.rank}</span>
        <span className="playing-card__suit-sm">{suit}</span>
      </div>

      <div className="playing-card__center" aria-hidden="true">
        {isPipRank(card.rank) && (
          <div className="playing-card__pips">
            {PIP_LAYOUTS[card.rank].map((pip, index) => (
              <span
                key={index}
                className={
                  pip.invert
                    ? 'playing-card__pip playing-card__pip--invert'
                    : 'playing-card__pip'
                }
                style={{ left: `${pip.x}%`, top: `${pip.y}%` }}
              >
                {suit}
              </span>
            ))}
          </div>
        )}
        {card.rank === 'A' && (
          <div className="playing-card__face playing-card__face--ace">
            <span className="playing-card__face-rank">A</span>
            <span className="playing-card__face-suit">{suit}</span>
          </div>
        )}
        {isFaceRank(card.rank) && (
          <div className="playing-card__face">
            <span className="playing-card__face-rank">{card.rank}</span>
            <span className="playing-card__face-suit">{suit}</span>
          </div>
        )}
      </div>
      <span className="sr-only">{`${card.rank} of ${card.suit}`}</span>
    </>
  );
}

export const PlayingCard = memo(function PlayingCard({
  card,
  compact = false,
  faceDown = false,
  animationMode = 'slide',
  className = '',
}: PlayingCardProps) {
  if (faceDown) {
    return (
      <div
        className={[
          'playing-card',
          'playing-card--back',
          compact ? 'playing-card--compact' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="Face-down card"
      />
    );
  }

  const red = isRedSuit(card.suit);
  const animClass = getDealAnimationClass(animationMode);

  return (
    <div
      className={[
        'playing-card',
        compact ? 'playing-card--compact' : '',
        red ? 'playing-card--red' : 'playing-card--black',
        animClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      <CardFace card={card} />
    </div>
  );
});
