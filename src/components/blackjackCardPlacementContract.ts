/**
 * blackjackCardPlacementContract.ts — per-mode card placement inside the cards zone.
 *
 * The shell (tableLayoutEngine + bj-blackjack-table-shell.css) owns zone geometry.
 * This contract owns HOW cards are placed inside `.bj-table-zone--cards` only.
 *
 * Modes must NOT share one generic positioning rule — Full Table uses box-column
 * anchors; Card View uses centered hero placement.
 */

import {
  LAYOUT_MODES,
  type LayoutMode,
  resolveLayoutMode,
  type DeviceClass,
  type ViewClass,
} from './tableLayoutEngine';

export const CARD_PLACEMENT_CONTRACT_VERSION = 'card-placement-v1' as const;

export type CardPlacementAnchor = 'boxColumn' | 'heroCenter';
export type CardVerticalAnchor = 'justAboveBoxValue' | 'centerHero';
/** clip-x = horizontal clip only; vertical growth allowed inside cards band. */
export type CardZoneOverflow = 'clip-x' | 'visible';

export interface CardPlacementModeSpec {
  mode: LayoutMode;
  anchor: CardPlacementAnchor;
  verticalAnchor: CardVerticalAnchor;
  /** Hands with more cards compress via overlap tokens before shrinking card scale. */
  maxVisibleCardsBeforeCompression: number;
  stackOverlapRem: { two: number; three: number; fourPlus: number };
  allowedOverflow: CardZoneOverflow;
  /** Minimum cards-zone row height (CSS length). Shell 1fr absorbs slack above this floor. */
  minCardsAreaHeight: string;
  cardScaleRem: { width: number; height: number };
  /** CSS custom properties applied on the view root for this mode. */
  cssTokenPrefix: string;
}

export const CARD_PLACEMENT_BY_MODE: Record<LayoutMode, CardPlacementModeSpec> = {
  desktopFull: {
    mode: 'desktopFull',
    anchor: 'boxColumn',
    verticalAnchor: 'justAboveBoxValue',
    maxVisibleCardsBeforeCompression: 5,
    stackOverlapRem: { two: 1.38, three: 1.9, fourPlus: 2.3 },
    allowedOverflow: 'clip-x',
    minCardsAreaHeight: '0',
    cardScaleRem: { width: 2.95, height: 3.95 },
    cssTokenPrefix: '--bj-placement-desktop-full',
  },
  desktopCard: {
    mode: 'desktopCard',
    anchor: 'heroCenter',
    verticalAnchor: 'centerHero',
    maxVisibleCardsBeforeCompression: 5,
    stackOverlapRem: { two: 0, three: 0, fourPlus: 0 },
    allowedOverflow: 'visible',
    minCardsAreaHeight: 'min(6.5rem, 20%)',
    cardScaleRem: { width: 7.25, height: 9.75 },
    cssTokenPrefix: '--bj-placement-desktop-card',
  },
  mobileFull: {
    mode: 'mobileFull',
    anchor: 'boxColumn',
    verticalAnchor: 'justAboveBoxValue',
    maxVisibleCardsBeforeCompression: 5,
    stackOverlapRem: { two: 0.68, three: 0.92, fourPlus: 1.12 },
    allowedOverflow: 'clip-x',
    minCardsAreaHeight: 'var(--bj-mobile-zone-cards-min-height, 0)',
    cardScaleRem: { width: 1.42, height: 1.92 },
    cssTokenPrefix: '--bj-placement-mobile-full',
  },
  mobileCard: {
    mode: 'mobileCard',
    anchor: 'heroCenter',
    verticalAnchor: 'centerHero',
    maxVisibleCardsBeforeCompression: 5,
    stackOverlapRem: { two: 0, three: 0, fourPlus: 0 },
    allowedOverflow: 'visible',
    minCardsAreaHeight: 'var(--bj-mobile-zone-cards-min-height, 0)',
    cardScaleRem: { width: 4.5, height: 6.25 },
    cssTokenPrefix: '--bj-placement-mobile-card',
  },
};

export function getCardPlacementSpec(mode: LayoutMode): CardPlacementModeSpec {
  return CARD_PLACEMENT_BY_MODE[mode];
}

export function getCardPlacementSpecFor(device: DeviceClass, view: ViewClass): CardPlacementModeSpec {
  return CARD_PLACEMENT_BY_MODE[resolveLayoutMode(device, view)];
}

/** data-card-placement value for the cards zone (debug + tests). */
export function cardPlacementDataAttribute(mode: LayoutMode): string {
  const spec = getCardPlacementSpec(mode);
  return `${spec.anchor}:${spec.verticalAnchor}`;
}

export function formatCardPlacementContractLabel(mode: LayoutMode): string {
  const spec = getCardPlacementSpec(mode);
  return `${CARD_PLACEMENT_CONTRACT_VERSION} · ${mode} · ${spec.anchor}/${spec.verticalAnchor}`;
}

/** Modes that use box-column arc stacks (Full Table only). */
export function isBoxColumnPlacement(mode: LayoutMode): boolean {
  return getCardPlacementSpec(mode).anchor === 'boxColumn';
}

/** Modes that use centered hero fan (Card View only). */
export function isHeroCenterPlacement(mode: LayoutMode): boolean {
  return getCardPlacementSpec(mode).anchor === 'heroCenter';
}

export { LAYOUT_MODES };
