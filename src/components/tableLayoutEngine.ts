/**
 * Table Layout Engine — canonical, neutral layout contract for the Blackjack table.
 *
 * PURPOSE
 * One stable description of HOW the Blackjack table is laid out, independent of
 * gameplay, phase, theme, and device. This file owns ROLE NAMES and PER-MODE
 * STRUCTURE only — it contains no gameplay logic, no rules, no payout/betting,
 * and no React/DOM. CSS files and the shell component must conform to this
 * contract; tests assert that they do.
 *
 * This replaces the previous situation where layout intent was implied by three
 * competing CSS engines (desktop grid, mobile-portrait flex, mobile-landscape
 * grid) with no single description. There is now ONE engine: a CSS grid keyed by
 * the same seven zone rows in every mode. Modes differ only in token values and
 * which inner component fills the `cards` zone — never in zone order, never in
 * which zone stretches, never in where boxes/cards baseline.
 *
 * See: docs/BLACKJACK_LAYOUT_CONTRACTS.md, blackjackLayoutContract.ts (view roots),
 * bj-blackjack-table-shell.css (sole shell geometry owner).
 */

/** Bumped whenever the engine's structural contract changes. Surfaced by ?layoutDebug=1. */
export const TABLE_LAYOUT_ENGINE_VERSION = 'table-layout-engine-v1' as const;

// ── Zones (roles) ────────────────────────────────────────────────────────────

/**
 * Canonical zone roles, top → bottom. This order is PHASE-INVARIANT and
 * MODE-INVARIANT: every layout mode renders these seven rows in this order in
 * every phase. Children render content into a zone; they never reorder zones.
 */
export const LAYOUT_ZONES = [
  'bankInfo',
  'dealer',
  'command',
  'cards',
  'actions',
  'boxes',
  'tray',
] as const;

export type LayoutZone = (typeof LAYOUT_ZONES)[number];

/** CSS grid row name for each zone (matches bj-blackjack-table-shell.css grid-template-rows). */
export const LAYOUT_ZONE_GRID_ROWS: Record<LayoutZone, string> = {
  bankInfo: 'bank-info',
  dealer: 'dealer',
  command: 'command',
  cards: 'cards',
  actions: 'actions',
  boxes: 'boxes',
  tray: 'tray',
};

/** Shell zone CSS class for each role (the DOM element the zone content mounts in). */
export const LAYOUT_ZONE_CLASS: Record<LayoutZone, string> = {
  bankInfo: 'bj-table-info-bar--felt-row',
  dealer: 'bj-dealer-area',
  command: 'bj-table-zone--summary',
  cards: 'bj-table-zone--cards',
  actions: 'bj-table-zone--actions',
  boxes: 'bj-table-zone--boxes',
  tray: 'bj-table-zone--bottom',
};

// ── Modes ────────────────────────────────────────────────────────────────────

export const LAYOUT_MODES = [
  'desktopFull',
  'desktopCard',
  'mobileFull',
  'mobileCard',
] as const;

export type LayoutMode = (typeof LAYOUT_MODES)[number];

export type DeviceClass = 'desktop' | 'mobile';
export type ViewClass = 'full' | 'card';

/** Whether the `cards` zone hosts the Full Table per-box stacks or the Card View hero fan. */
export type CardsAreaMode = 'table' | 'hero';

/** Per-zone sizing intent. Exactly one zone per mode is `stretch`. */
export type ZoneSizing = 'fixed' | 'stretch';

/**
 * Allowed overflow per zone:
 * - `clip-x`  → overflow-x hidden, overflow-y visible (prevents horizontal page scroll)
 * - `visible` → content may extend (card tops/fans read outside the band)
 * - `hidden`  → internal content clipped to the band
 */
export type ZoneOverflow = 'clip-x' | 'visible' | 'hidden';

export interface LayoutModeSpec {
  mode: LayoutMode;
  device: DeviceClass;
  view: ViewClass;
  /** Canonical view-root class (see VIEW_ROOT_CLASSES in blackjackLayoutContract.ts). */
  viewRootClass: string;
  /** Which inner component fills the `cards` zone. */
  cardsAreaMode: CardsAreaMode;
  /** Zone order top → bottom. MUST equal LAYOUT_ZONES (phase- and mode-invariant). */
  zoneOrder: readonly LayoutZone[];
  /** The single zone that absorbs free vertical space. Always `cards`. */
  stretchZone: LayoutZone;
  /** Zones with fixed/token heights (do not grow). */
  fixedZones: readonly LayoutZone[];
  /**
   * Where the player boxes baseline sits. Identical for Full Table and Card View
   * on the same device so Table View and Card View boxes share a baseline.
   */
  boxesBaseline: 'directly-above-tray';
  /** Where cards baseline sits inside the `cards` zone. */
  cardsBaseline: 'grow-up-from-actions' | 'fill-hero';
  /** Allowed overflow per zone. */
  overflow: Record<LayoutZone, ZoneOverflow>;
  /** Rows guaranteed not to move or reorder across phases. Always all seven zones. */
  phaseInvariantRows: readonly LayoutZone[];
  /** CSS file that owns this mode's shell grid geometry. Always the shell file. */
  shellOwnerCss: string;
}

const SHELL_OWNER_CSS = 'src/styles/bj-blackjack-table-shell.css';

function makeOverflow(): Record<LayoutZone, ZoneOverflow> {
  return {
    bankInfo: 'visible',
    dealer: 'hidden',
    command: 'visible',
    // Cards must stay visible so card tops / fans read outside the fixed band.
    cards: 'visible',
    actions: 'visible',
    boxes: 'visible',
    tray: 'hidden',
  };
}

function makeModeSpec(
  mode: LayoutMode,
  device: DeviceClass,
  view: ViewClass,
  viewRootClass: string,
): LayoutModeSpec {
  const cardsAreaMode: CardsAreaMode = view === 'card' ? 'hero' : 'table';
  return {
    mode,
    device,
    view,
    viewRootClass,
    cardsAreaMode,
    zoneOrder: LAYOUT_ZONES,
    stretchZone: 'cards',
    fixedZones: ['bankInfo', 'dealer', 'command', 'actions', 'boxes', 'tray'],
    boxesBaseline: 'directly-above-tray',
    cardsBaseline: cardsAreaMode === 'hero' ? 'fill-hero' : 'grow-up-from-actions',
    overflow: makeOverflow(),
    phaseInvariantRows: LAYOUT_ZONES,
    shellOwnerCss: SHELL_OWNER_CSS,
  };
}

export const LAYOUT_MODE_SPECS: Record<LayoutMode, LayoutModeSpec> = {
  desktopFull: makeModeSpec('desktopFull', 'desktop', 'full', 'bj-view-full-desktop'),
  desktopCard: makeModeSpec('desktopCard', 'desktop', 'card', 'bj-view-card-desktop'),
  mobileFull: makeModeSpec('mobileFull', 'mobile', 'full', 'bj-view-full-mobile'),
  mobileCard: makeModeSpec('mobileCard', 'mobile', 'card', 'bj-view-card-mobile'),
};

// ── Resolution helpers ─────────────────────────────────────────────────────────

export function resolveLayoutMode(device: DeviceClass, view: ViewClass): LayoutMode {
  if (device === 'desktop') {
    return view === 'card' ? 'desktopCard' : 'desktopFull';
  }
  return view === 'card' ? 'mobileCard' : 'mobileFull';
}

export function getLayoutModeSpec(mode: LayoutMode): LayoutModeSpec {
  return LAYOUT_MODE_SPECS[mode];
}

/** Resolve a mode spec directly from device + view. */
export function getLayoutModeSpecFor(device: DeviceClass, view: ViewClass): LayoutModeSpec {
  return LAYOUT_MODE_SPECS[resolveLayoutMode(device, view)];
}

// ── Ownership rules (enforced by tests) ─────────────────────────────────────────

/**
 * CSS ownership map: which file may own which kind of geometry for each zone.
 * Tests in productionRouteOwnership.test.ts assert competing files do NOT
 * redefine shell grid geometry, and that each file's header declares its scope.
 */
export const CSS_OWNERSHIP = {
  /** Sole owner of shell grid + every zone's outer placement / band height, all 4 modes. */
  shellGeometry: 'src/styles/bj-blackjack-table-shell.css',
  /** Full Table per-box card-stack geometry INSIDE the cards zone only. */
  fullTableCardStack: 'src/styles/bj-full-table-card-area.css',
  /** Card View hero content INSIDE the cards zone only (desktop). */
  cardViewHeroDesktop: 'src/styles/bj-card-desktop-hero-area.css',
  /** Card View hero content INSIDE the cards zone only (mobile portrait). */
  cardViewHeroMobile: 'src/styles/bj-card-mobile-portrait-layout.css',
  /** Tokens / colors / visuals only — never shell geometry. */
  tokensAndVisuals: 'src/styles/bj-table-shared.css',
  /** Theme only — no layout geometry. */
  themeOnly: 'src/styles/sxm-stitch-visual.css',
} as const;

/**
 * Children (zone content) may NOT move themselves out of their assigned zone with
 * these declarations. The shell owns placement. (Card-fan internal overlap, in-box
 * layout, and in-chip layout are allowed and are NOT zone movers.)
 */
export const FORBIDDEN_ZONE_MOVER_DECLARATIONS = [
  'margin-top: auto',
  'margin-top:auto',
  'translateY',
  'position: absolute', // for a zone wrapper; decorative children are exempt
] as const;

/**
 * The zone classes the shell owns. CSS files other than the shell owner must not
 * set grid-row / grid-template / outer band height / margin-top:auto on these.
 */
export const SHELL_OWNED_ZONE_CLASSES = Object.values(LAYOUT_ZONE_CLASS);
