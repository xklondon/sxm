import type { ReactNode } from 'react';
import {
  BlackjackActionsZone,
  BlackjackCardsAreaZone,
  BlackjackCommandZone,
  BlackjackPlayerBoxesZone,
} from './blackjackViewZones';
import { TABLE_UX } from './tableUxContract';

export type BlackjackCardsAreaMode = 'table' | 'hero';

export interface BlackjackTableLayoutShellProps {
  feltClothLayer?: ReactNode;
  dealer: ReactNode;
  command: ReactNode;
  summaryExtras?: ReactNode;
  actions: ReactNode;
  cardsArea: ReactNode;
  cardsAreaMode: BlackjackCardsAreaMode;
  playerBoxes: ReactNode;
  chipTray: ReactNode;
}

/**
 * Canonical blackjack table layout — same DOM order for Full Table and Card View.
 * Dealer → Command → Actions → CardsArea → PlayerBoxes → ChipTray
 */
export function BlackjackTableLayoutShell({
  feltClothLayer,
  dealer,
  command,
  summaryExtras,
  actions,
  cardsArea,
  cardsAreaMode,
  playerBoxes,
  chipTray,
}: BlackjackTableLayoutShellProps) {
  return (
    <div className={`bj-casino__felt-main ${TABLE_UX.tableLayoutShell}`}>
      {feltClothLayer}
      {dealer}

      <BlackjackCommandZone>
        {command}
        {summaryExtras}
      </BlackjackCommandZone>

      <BlackjackActionsZone>{actions}</BlackjackActionsZone>

      <BlackjackCardsAreaZone mode={cardsAreaMode}>{cardsArea}</BlackjackCardsAreaZone>

      <BlackjackPlayerBoxesZone>{playerBoxes}</BlackjackPlayerBoxesZone>

      <div className={`bj-table-zone ${TABLE_UX.tableZoneBottom}`}>{chipTray}</div>
    </div>
  );
}
