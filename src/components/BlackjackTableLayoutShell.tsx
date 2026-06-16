import type { ReactNode } from 'react';
import {
  BlackjackActionsZone,
  BlackjackCardsAreaZone,
  BlackjackCommandZone,
  BlackjackHeroValueZone,
  BlackjackPlayerBoxesZone,
} from './blackjackViewZones';
import { TABLE_UX } from './tableUxContract';

export type BlackjackCardsAreaMode = 'table' | 'hero';

export interface BlackjackTableLayoutShellProps {
  /** Bank total / hand — first row inside felt, above dealer cards. */
  tableBankInfo?: ReactNode;
  feltClothLayer?: ReactNode;
  dealer: ReactNode;
  command: ReactNode;
  summaryExtras?: ReactNode;
  actions: ReactNode;
  cardsArea: ReactNode;
  cardsAreaMode: BlackjackCardsAreaMode;
  /** Card View — hero total row between cards and actions (not an overlay). */
  heroValue?: ReactNode;
  playerBoxes: ReactNode;
  chipTray: ReactNode;
  layoutDebug?: boolean;
}

/**
 * Canonical blackjack table layout — same DOM order for Full Table and Card View.
 * Dealer → Command → CardsArea → HeroValue? → Actions → PlayerBoxes → ChipTray
 */
export function BlackjackTableLayoutShell({
  tableBankInfo,
  feltClothLayer,
  dealer,
  command,
  summaryExtras,
  actions,
  cardsArea,
  cardsAreaMode,
  heroValue,
  playerBoxes,
  chipTray,
  layoutDebug = false,
}: BlackjackTableLayoutShellProps) {
  return (
    <div
      className={[
        `bj-casino__felt-main ${TABLE_UX.tableLayoutShell}`,
        layoutDebug ? TABLE_UX.layoutDebug : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-layout-debug={layoutDebug ? '1' : undefined}
    >
      {tableBankInfo}

      {dealer}

      <BlackjackCommandZone>
        {command}
        {summaryExtras}
      </BlackjackCommandZone>

      <BlackjackCardsAreaZone mode={cardsAreaMode}>
        {feltClothLayer}
        {cardsArea}
      </BlackjackCardsAreaZone>

      {heroValue ? <BlackjackHeroValueZone>{heroValue}</BlackjackHeroValueZone> : null}

      <BlackjackActionsZone>{actions}</BlackjackActionsZone>

      <BlackjackPlayerBoxesZone>{playerBoxes}</BlackjackPlayerBoxesZone>

      <div className={`bj-table-zone ${TABLE_UX.tableZoneBottom}`}>{chipTray}</div>
    </div>
  );
}
