import { useId } from 'react';
import { TABLE_UX } from './tableUxContract';

export interface BlackjackFeltClothLayerProps {
  tableName: string;
  wagerText?: string;
  protocolText?: string;
  customRulesText?: string;
}

/** Responsive SVG cloth markings — non-interactive decor behind gameplay zones. */
export function BlackjackFeltClothLayer({
  tableName,
  wagerText = '',
  protocolText = '',
  customRulesText = 'House Rules: Standard',
}: BlackjackFeltClothLayerProps) {
  const uid = useId().replace(/:/g, '');
  const titleArcId = `bj-cloth-title-${uid}`;
  const insuranceArcId = `bj-cloth-insurance-${uid}`;
  const protocolArcId = `bj-cloth-protocol-${uid}`;
  const customRulesArcId = `bj-cloth-custom-${uid}`;
  const trimmedWager = wagerText.trim();
  const trimmedProtocol = protocolText.trim();
  const trimmedCustomRules = customRulesText.trim() || 'House Rules: Standard';

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
          <path id={protocolArcId} d="M 92 200 Q 500 176 908 200" />
          <path id={customRulesArcId} d="M 92 240 Q 500 216 908 240" />
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
          <textPath href={`#${protocolArcId}`} startOffset="50%" textAnchor="middle">
            {trimmedProtocol || 'Standard protocol'}
          </textPath>
        </text>

        <text className={`${TABLE_UX.feltClothLayer}__custom-rules`}>
          <textPath href={`#${customRulesArcId}`} startOffset="50%" textAnchor="middle">
            {trimmedCustomRules}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
