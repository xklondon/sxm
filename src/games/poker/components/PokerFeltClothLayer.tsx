import { useId } from 'react';
import { POKER_TEMPLATE_CLOTH } from '../pokerTemplateContract';

export interface PokerFeltClothLayerProps {
  tableName: string;
  wagerText?: string;
  blindsText: string;
}

/** Arc cloth title integrated into poker felt — mirrors blackjack cloth typography. */
export function PokerFeltClothLayer({
  tableName,
  wagerText = '',
  blindsText,
}: PokerFeltClothLayerProps) {
  const uid = useId().replace(/:/g, '');
  const titleArcId = `poker-cloth-title-${uid}`;
  const subArcId = `poker-cloth-sub-${uid}`;
  const blindsArcId = `poker-cloth-blinds-${uid}`;
  const trimmedWager = wagerText.trim();

  return (
    <div className={`poker-felt-cloth-layer ${POKER_TEMPLATE_CLOTH}`} aria-hidden="true">
      <svg
        className="poker-felt-cloth-layer__svg"
        viewBox="0 0 1000 220"
        preserveAspectRatio="xMidYMid meet"
        role="presentation"
      >
        <defs>
          <path id={titleArcId} d="M 80 72 Q 500 34 920 72" />
          <path id={subArcId} d="M 100 118 Q 500 96 900 118" />
          <path id={blindsArcId} d="M 120 158 Q 500 138 880 158" />
        </defs>
        <text className="poker-felt-cloth-layer__title">
          <textPath href={`#${titleArcId}`} startOffset="50%" textAnchor="middle">
            {tableName}
          </textPath>
        </text>
        {trimmedWager && (
          <text className="poker-felt-cloth-layer__wager">
            <textPath href={`#${subArcId}`} startOffset="50%" textAnchor="middle">
              {trimmedWager}
            </textPath>
          </text>
        )}
        <text className="poker-felt-cloth-layer__blinds">
          <textPath href={`#${blindsArcId}`} startOffset="50%" textAnchor="middle">
            {blindsText}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
