import type { ReactNode } from 'react';
import { SXM_LAYOUT, sxmSectionProps } from './sxmLayoutContract';
import { TABLE_UX } from './tableUxContract';
import type { BlackjackCardsAreaMode } from './BlackjackTableLayoutShell';

/** Shared command/status zone — same slot in Full Table and Card View. */
export function BlackjackCommandZone({ children }: { children: ReactNode }) {
  return (
    <div
      {...sxmSectionProps(SXM_LAYOUT.statusZone, `bj-table-zone ${TABLE_UX.tableZoneSummary}`)}
    >
      {children}
    </div>
  );
}

/** Shared player action zone — Hit/Stay/2×/Split/AID and phase actions. */
export function BlackjackActionsZone({ children }: { children: ReactNode }) {
  return (
    <div
      {...sxmSectionProps(SXM_LAYOUT.actionZone, `bj-table-zone ${TABLE_UX.tableZoneActions}`)}
    >
      {children}
    </div>
  );
}

/** Shared player boxes zone — flat open U arc in both views. */
export function BlackjackPlayerBoxesZone({ children }: { children: ReactNode }) {
  return (
    <div
      {...sxmSectionProps(
        SXM_LAYOUT.playerBoxesZone,
        `bj-table-zone ${TABLE_UX.tableZoneBoxes}`,
      )}
    >
      {children}
    </div>
  );
}

/** View-specific cards area — table arc stacks or Card View hero fan. */
export function BlackjackCardsAreaZone({
  mode,
  children,
}: {
  mode: BlackjackCardsAreaMode;
  children: ReactNode;
}) {
  const modeClass = mode === 'hero' ? TABLE_UX.cardsAreaHero : TABLE_UX.cardsAreaTable;
  return (
    <div
      {...sxmSectionProps(
        SXM_LAYOUT.heroZone,
        `bj-table-zone ${TABLE_UX.tableZoneCards}`,
        modeClass,
      )}
    >
      {children}
    </div>
  );
}
