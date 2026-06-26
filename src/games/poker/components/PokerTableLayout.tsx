import type { ReactNode } from 'react';
import {
  POKER_TEMPLATE_CENTER,
  POKER_TEMPLATE_STAGE,
  POKER_TEMPLATE_TABLE,
} from '../pokerTemplateContract';

interface PokerTableLayoutProps {
  topBar?: ReactNode;
  seatRing: ReactNode;
  communityBoard: ReactNode;
  potArea: ReactNode;
  actionPanel: ReactNode;
  feltHeader?: ReactNode;
  feltCenterOverlay?: ReactNode;
}

export function PokerTableLayout({
  topBar,
  seatRing,
  communityBoard,
  potArea,
  actionPanel,
  feltHeader,
  feltCenterOverlay,
}: PokerTableLayoutProps) {
  return (
    <div className="poker-table-layout poker-hr-layout">
      {topBar}

      <div className={`poker-table-layout__stage ${POKER_TEMPLATE_STAGE}`}>
        <div className={`poker-table-layout__felt ${POKER_TEMPLATE_TABLE}`} aria-label="Poker table felt">
          {feltHeader}
          {seatRing}
          <div className={`poker-table-layout__center ${POKER_TEMPLATE_CENTER}`}>
            {potArea}
            {communityBoard}
            {feltCenterOverlay}
          </div>
        </div>
      </div>

      <div className="poker-table-layout__actions poker-hr-layout__actions">{actionPanel}</div>
    </div>
  );
}
