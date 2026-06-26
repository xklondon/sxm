import type { ReactNode } from 'react';
import {
  POKER_TEMPLATE_CENTER,
  POKER_TEMPLATE_STAGE,
  POKER_TEMPLATE_TABLE,
} from '../pokerTemplateContract';
import { POKER0_CENTER_GRID_AREA } from '../poker0SeatLayout';

interface PokerTableLayoutProps {
  topBar?: ReactNode;
  seatRing: ReactNode;
  communityBoard: ReactNode;
  feltShowdown?: ReactNode;
  actionPanel: ReactNode;
  feltCloth?: ReactNode;
}

export function PokerTableLayout({
  topBar,
  seatRing,
  communityBoard,
  feltShowdown,
  actionPanel,
  feltCloth,
}: PokerTableLayoutProps) {
  return (
    <div className="poker-table-layout poker0-layout">
      {topBar}

      <div className={`poker-table-layout__stage ${POKER_TEMPLATE_STAGE}`}>
        <div
          className={`poker-table-layout__felt ${POKER_TEMPLATE_TABLE}`}
          aria-label="Poker table felt"
          data-testid="poker0-felt"
        >
          {feltCloth}
          {seatRing}
          <div
            className={`poker-table-layout__center ${POKER_TEMPLATE_CENTER}`}
            style={{ gridArea: POKER0_CENTER_GRID_AREA }}
            data-testid="poker-felt-center"
          >
            {communityBoard}
            {feltShowdown}
          </div>
        </div>
      </div>

      <div className="poker-table-layout__actions poker0-layout__actions">{actionPanel}</div>
    </div>
  );
}
