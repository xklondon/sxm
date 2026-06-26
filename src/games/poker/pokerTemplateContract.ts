/**
 * Visual contract for Poker production UI.
 * Source: reference-ui/Poker/Poker 0/Poker0Cannonical_Layout.png — Poker 0 canonical layout.
 */
import {
  POKER0_ACTION_BAR,
  POKER0_CLOTH,
  POKER0_FELT,
  POKER0_HEADER,
  POKER0_HEADER_CONTROLS,
  POKER0_HEADER_DEAL,
  POKER0_CENTER,
  POKER0_REFERENCE_IMAGE,
  POKER0_SEAT_RING,
  POKER0_SHELL,
  POKER0_STAGE,
} from './poker0LayoutContract';

export const POKER_TEMPLATE_REFERENCE_PATH = POKER0_REFERENCE_IMAGE.replace(/\/[^/]+$/, '');

export const POKER_TEMPLATE_REFERENCE_FILES = [POKER0_REFERENCE_IMAGE] as const;

/** Root shell — Poker 0 session wrapper. */
export const POKER_TEMPLATE_SHELL = POKER0_SHELL;

/** Poker 0 header row. */
export const POKER_TEMPLATE_TOPBAR = POKER0_HEADER;

/** Oval felt stage. */
export const POKER_TEMPLATE_STAGE = POKER0_STAGE;

/** Oval table surface (7×7 grid). */
export const POKER_TEMPLATE_TABLE = POKER0_FELT;

/** Embossed table name on cloth. */
export const POKER_TEMPLATE_CLOTH = POKER0_CLOTH;

/** Grid seat ring. */
export const POKER_TEMPLATE_SEAT_RING = POKER0_SEAT_RING;

/** Community + showdown center. */
export const POKER_TEMPLATE_CENTER = POKER0_CENTER;

/** Header controls band (pot, blinds, deal). */
export const POKER_TEMPLATE_HEADER_METRICS = POKER0_HEADER_CONTROLS;

/** Header deal / start control. */
export const POKER_TEMPLATE_DEAL_BTN = POKER0_HEADER_DEAL;

/** Action bar below felt. */
export const POKER_TEMPLATE_ACTION_BAR = POKER0_ACTION_BAR;

/** @deprecated High Roller alias — use POKER0_SHELL */
export const POKER_HR_SHELL_ALIAS = 'poker-hr-shell';
