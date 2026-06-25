import type { ReactNode } from 'react';

interface PokerTableLayoutProps {
  toolbar?: ReactNode;
  seatRing: ReactNode;
  communityBoard: ReactNode;
  potArea: ReactNode;
  actionPanel: ReactNode;
  chatDock?: ReactNode;
}

export function PokerTableLayout({
  toolbar,
  seatRing,
  communityBoard,
  potArea,
  actionPanel,
  chatDock,
}: PokerTableLayoutProps) {
  return (
    <div className="poker-table-layout">
      {toolbar}

      <div className="poker-table-layout__main">
        <div className="poker-table-layout__felt" aria-label="Poker table felt">
          {seatRing}
          <div className="poker-table-layout__center">
            {potArea}
            {communityBoard}
          </div>
        </div>

        <div className="poker-table-layout__controls">
          {actionPanel}
          {chatDock}
        </div>
      </div>
    </div>
  );
}
