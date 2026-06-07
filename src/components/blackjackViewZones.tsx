import type { ReactNode } from 'react';
import { SXM_LAYOUT, sxmSectionProps } from './sxmLayoutContract';
import { TABLE_UX } from './tableUxContract';

/** Shared command/status zone — Full Table summary row or Card View summary row. */
export function BlackjackCommandZone({
  variant,
  children,
}: {
  variant: 'table' | 'card';
  children: ReactNode;
}) {
  if (variant === 'table') {
    return (
      <div
        {...sxmSectionProps(SXM_LAYOUT.statusZone, `bj-table-zone ${TABLE_UX.tableZoneSummary}`)}
      >
        {children}
      </div>
    );
  }
  return (
    <div {...sxmSectionProps(SXM_LAYOUT.statusZone, TABLE_UX.cardLayoutSummary)}>{children}</div>
  );
}

/** Shared player action zone — Hit/Stay/2×/Split/AID and phase actions. */
export function BlackjackActionsZone({
  variant,
  children,
}: {
  variant: 'table' | 'card';
  children: ReactNode;
}) {
  if (variant === 'table') {
    return (
      <div
        {...sxmSectionProps(SXM_LAYOUT.actionZone, `bj-table-zone ${TABLE_UX.tableZoneActions}`)}
      >
        {children}
      </div>
    );
  }
  return (
    <div {...sxmSectionProps(SXM_LAYOUT.actionZone, TABLE_UX.cardLayoutActions)}>{children}</div>
  );
}

/** Shared player boxes zone — arc seats (table) or mini row (card). */
export function BlackjackPlayerBoxesZone({
  variant,
  children,
}: {
  variant: 'table' | 'card';
  children: ReactNode;
}) {
  if (variant === 'table') {
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
  return (
    <div {...sxmSectionProps(SXM_LAYOUT.playerBoxesZone, TABLE_UX.cardLayoutBoxes)}>
      {children}
    </div>
  );
}

/** View-specific cards area — Full Table arc stacks or Card View hero. */
export function BlackjackCardsAreaZone({
  variant,
  children,
}: {
  variant: 'table' | 'card';
  children: ReactNode;
}) {
  if (variant === 'table') {
    return (
      <div
        {...sxmSectionProps(SXM_LAYOUT.heroZone, `bj-table-zone ${TABLE_UX.tableZoneCards}`)}
      >
        {children}
      </div>
    );
  }
  return (
    <div {...sxmSectionProps(SXM_LAYOUT.heroZone, TABLE_UX.cardLayoutHero)}>{children}</div>
  );
}
