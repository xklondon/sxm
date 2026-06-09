import { useId } from 'react';
import { TABLE_UX } from './tableUxContract';

export interface BlackjackFeltClothLayerProps {
  tableName: string;
  wagerText?: string;
}

/** Responsive SVG cloth markings — non-interactive decor behind gameplay zones. */
export function BlackjackFeltClothLayer({ tableName, wagerText = '' }: BlackjackFeltClothLayerProps) {
  const uid = useId().replace(/:/g, '');
  const titleArcId = `bj-cloth-title-${uid}`;
  const insuranceArcId = `bj-cloth-insurance-${uid}`;
  const dealerArcId = `bj-cloth-dealer-${uid}`;
  const trimmedWager = wagerText.trim();

  return (
    <div className={TABLE_UX.feltClothLayer} aria-hidden="true">
      <svg
        className={`${TABLE_UX.feltClothLayer}__svg`}
        viewBox="0 0 1000 280"
        preserveAspectRatio="xMidYMid meet"
        role="presentation"
      >
        <defs>
          <path id={titleArcId} d="M 72 88 Q 500 46 928 88" />
          <path id={insuranceArcId} d="M 100 150 Q 500 126 900 150" />
          <path id={dealerArcId} d="M 92 220 Q 500 194 908 220" />
        </defs>

        <text className={`${TABLE_UX.feltClothLayer}__title`}>
          <textPath href={`#${titleArcId}`} startOffset="50%" textAnchor="middle">
            {tableName}
          </textPath>
        </text>

        <text className={`${TABLE_UX.feltClothLayer}__insurance`}>
          <textPath href={`#${insuranceArcId}`} startOffset="50%" textAnchor="middle">
            {trimmedWager ? `Playing for ${trimmedWager}` : 'Insurance Pays 2 to 1'}
          </textPath>
        </text>

        <text className={`${TABLE_UX.feltClothLayer}__dealer-rule`}>
          <textPath href={`#${dealerArcId}`} startOffset="50%" textAnchor="middle">
            Dealer must stand on 17 and draw to 16
          </textPath>
        </text>
      </svg>
    </div>
  );
}
