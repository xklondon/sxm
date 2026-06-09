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
        viewBox="0 0 1000 260"
        preserveAspectRatio="xMidYMin meet"
        role="presentation"
      >
        <defs>
          <path id={titleArcId} d="M 80 42 Q 500 8 920 42" />
          <path id={insuranceArcId} d="M 110 108 Q 500 78 890 108" />
          <path id={dealerArcId} d="M 90 182 Q 500 152 910 182" />
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
