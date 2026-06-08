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
  const boxArcId = `bj-cloth-box-${uid}`;
  const trimmedWager = wagerText.trim();

  return (
    <div className={TABLE_UX.feltClothLayer} aria-hidden="true">
      <svg
        className={`${TABLE_UX.feltClothLayer}__svg`}
        viewBox="0 0 1000 620"
        preserveAspectRatio="xMidYMid meet"
        role="presentation"
      >
        <defs>
          <path id={titleArcId} d="M 90 300 Q 500 170 910 300" />
          <path id={insuranceArcId} d="M 150 360 Q 500 270 850 360" />
          <path id={dealerArcId} d="M 120 410 Q 500 330 880 410" />
          <path id={boxArcId} d="M 70 520 Q 500 455 930 520" />
        </defs>

        <path
          className={`${TABLE_UX.feltClothLayer}__box-guide`}
          d="M 70 520 Q 500 455 930 520"
          fill="none"
        />

        <text className={`${TABLE_UX.feltClothLayer}__title`}>
          <textPath href={`#${titleArcId}`} startOffset="50%" textAnchor="middle">
            {tableName}
          </textPath>
        </text>

        <text className={`${TABLE_UX.feltClothLayer}__insurance`}>
          <textPath href={`#${insuranceArcId}`} startOffset="50%" textAnchor="middle">
            Insurance Pays 2 to 1
          </textPath>
        </text>

        <text className={`${TABLE_UX.feltClothLayer}__dealer-rule`}>
          <textPath href={`#${dealerArcId}`} startOffset="50%" textAnchor="middle">
            Dealer must stand on 17 and draw to 16
          </textPath>
        </text>

        {trimmedWager ? (
          <text className={`${TABLE_UX.feltClothLayer}__wager`} x="500" y="470" textAnchor="middle">
            Playing for: {trimmedWager}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
