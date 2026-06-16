import type { ReactNode } from 'react';

export interface BlackjackPlayerBoxRowProps {
  children: ReactNode;
}

/** Marker wrapper — player box markup stays in renderArcSlot; both views share this band. */
export function BlackjackPlayerBoxRow({ children }: BlackjackPlayerBoxRowProps) {
  return (
    <div className="bj-player-box-row" data-layout-band="player-boxes">
      {children}
    </div>
  );
}
