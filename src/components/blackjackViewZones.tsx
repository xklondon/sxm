import type { ReactNode } from 'react';
import { SXM_LAYOUT, sxmSectionProps } from './sxmLayoutContract';
import { TABLE_UX } from './tableUxContract';
import type { BlackjackCardsAreaMode } from './BlackjackTableLayoutShell';
import {
  cardPlacementDataAttribute,
  getCardPlacementSpecFor,
} from './blackjackCardPlacementContract';
import { resolveLayoutMode, type LayoutMode } from './tableLayoutEngine';

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

/** Card View hero total — explicit row between hero cards and action row. */
export function BlackjackHeroValueZone({ children }: { children: ReactNode }) {
  return (
    <div
      {...sxmSectionProps(
        SXM_LAYOUT.handTotal,
        `bj-table-zone bj-table-zone--hero-value`,
      )}
      data-layout-band="hero-value"
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
  deviceView = 'desktop',
  children,
}: {
  mode: BlackjackCardsAreaMode;
  deviceView?: 'desktop' | 'mobile';
  children: ReactNode;
}) {
  const modeClass = mode === 'hero' ? TABLE_UX.cardsAreaHero : TABLE_UX.cardsAreaTable;
  const layoutMode: LayoutMode = resolveLayoutMode(
    deviceView === 'mobile' ? 'mobile' : 'desktop',
    mode === 'hero' ? 'card' : 'full',
  );
  const placement = getCardPlacementSpecFor(
    deviceView === 'mobile' ? 'mobile' : 'desktop',
    mode === 'hero' ? 'card' : 'full',
  );
  return (
    <div
      {...sxmSectionProps(
        SXM_LAYOUT.heroZone,
        `bj-table-zone ${TABLE_UX.tableZoneCards}`,
        modeClass,
      )}
      data-card-placement={cardPlacementDataAttribute(layoutMode)}
      data-placement-overflow={placement.allowedOverflow}
    >
      {children}
    </div>
  );
}
