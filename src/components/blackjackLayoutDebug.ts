/** Dev-only layout zone overlay — enable with `?layoutDebug=1` in the URL. */
import { isVerboseDevLogging } from '../utils/devFlags';
import {
  BLACKJACK_CSS_LAYOUT_ROUTE_VERSION,
  BLACKJACK_TABLE_LAYOUT_SHELL_NAME,
  CANONICAL_BLACKJACK_CSS_IMPORT_ORDER,
  FULL_TABLE_SHELL_ZONE_ORDER,
} from './blackjackLayoutContract';
import {
  CSS_OWNERSHIP,
  LAYOUT_ZONES,
  LAYOUT_ZONE_CLASS,
  resolveLayoutMode,
  type DeviceClass,
  type LayoutMode,
  type LayoutZone,
  type ViewClass,
} from './tableLayoutEngine';

export { TABLE_LAYOUT_ENGINE_VERSION } from './tableLayoutEngine';

/** Per-zone CSS owner file surfaced by the debug overlay (matches CSS file headers). */
const ZONE_CSS_OWNER: Record<LayoutZone, string> = {
  bankInfo: CSS_OWNERSHIP.shellGeometry,
  dealer: CSS_OWNERSHIP.shellGeometry,
  command: CSS_OWNERSHIP.shellGeometry,
  cards: `${CSS_OWNERSHIP.shellGeometry} (band) + cards-area/hero (content)`,
  actions: CSS_OWNERSHIP.shellGeometry,
  boxes: CSS_OWNERSHIP.shellGeometry,
  tray: CSS_OWNERSHIP.shellGeometry,
};

/** Resolve the active layout mode from device + view-mode strings. */
export function resolveLayoutModeFromStrings(
  deviceView: string,
  viewMode: string,
): LayoutMode {
  const device: DeviceClass = deviceView === 'mobile' ? 'mobile' : 'desktop';
  const view: ViewClass = viewMode === 'card' ? 'card' : 'full';
  return resolveLayoutMode(device, view);
}

export const BLACKJACK_LAYOUT_DEBUG_PARAM = 'layoutDebug';
/** Build marker — confirms production bundle includes this audit pass. */
export const BLACKJACK_UI_FIX_VERSION = 'ui-reveal-gate-stabilization-1';

export { BLACKJACK_CSS_LAYOUT_ROUTE_VERSION, BLACKJACK_TABLE_LAYOUT_SHELL_NAME, CANONICAL_BLACKJACK_CSS_IMPORT_ORDER };

/** Human-readable CSS route for debug overlay. */
export function formatBlackjackCssImportRoute(): string {
  return `${BLACKJACK_CSS_LAYOUT_ROUTE_VERSION} · ${CANONICAL_BLACKJACK_CSS_IMPORT_ORDER.length} files · shell=${CANONICAL_BLACKJACK_CSS_IMPORT_ORDER.indexOf('src/styles/bj-blackjack-table-shell.css') + 1}`;
}

/** Shell zone order string for debug overlay. */
export function formatBlackjackShellZoneOrder(): string {
  return FULL_TABLE_SHELL_ZONE_ORDER.join(' → ');
}

/** Local override — set true while tuning zones; never ship enabled. */
const BLACKJACK_LAYOUT_DEBUG_FORCE = false;

export function isBlackjackLayoutDebugEnabled(search = ''): boolean {
  if (BLACKJACK_LAYOUT_DEBUG_FORCE) {
    return true;
  }
  if (!search) {
    return false;
  }
  return new URLSearchParams(search).get(BLACKJACK_LAYOUT_DEBUG_PARAM) === '1';
}

export interface LayoutZoneDiagnostic {
  zone: LayoutZone;
  zoneClass: string;
  present: boolean;
  bounds: string;
  cssOwner: string;
  /** First meaningful child component class rendered into the zone. */
  renderedComponent: string;
}

export interface LayoutDebugComputedSnapshot {
  /** Resolved layout mode: desktopFull | desktopCard | mobileFull | mobileCard. */
  layoutMode: string;
  shellDisplay: string;
  shellGridRows: string;
  zoneDiagnostics: LayoutZoneDiagnostic[];
  boxesRowDisplay: string;
  boxesRowGridTemplate: string;
  addBoxWidth: string;
  addBoxHeight: string;
  firstBoxWidth: string;
  firstBoxHeight: string;
  boxesGap: string;
  boxesZoneOverflowX: string;
  boxesZoneOverflowY: string;
  trayPosition: string;
  trayDisplay: string;
  trayHeight: string;
  trayPaddingBottom: string;
  canvasHeight: string;
  playerBoxDomOrder: string;
  trayBounds: string;
  playerRowBounds: string;
  trayOverlapsPlayerRow: boolean;
  trayOverflowChain: string;
  cardsZoneOverflow: string;
  cardStackBounds: string;
  overlapWarnings: string[];
}

function readOverflowChain(el: Element | null): string {
  if (!el || typeof window === 'undefined') {
    return 'n/a';
  }
  const parts: string[] = [];
  let node: Element | null = el;
  while (node) {
    const style = window.getComputedStyle(node);
    if (
      style.overflow !== 'visible' ||
      style.overflowX !== 'visible' ||
      style.overflowY !== 'visible'
    ) {
      const label =
        node instanceof HTMLElement && node.className
          ? `.${String(node.className).trim().split(/\s+/).slice(0, 2).join('.')}`
          : node.tagName.toLowerCase();
      parts.push(`${label}: ox=${style.overflowX} oy=${style.overflowY}`);
    }
    node = node.parentElement;
  }
  return parts.length ? parts.join(' | ') : 'all-visible';
}

function formatBounds(rect: DOMRect | undefined): string {
  if (!rect) {
    return 'n/a';
  }
  return `t=${Math.round(rect.top)} b=${Math.round(rect.bottom)} h=${Math.round(rect.height)}`;
}

/** First non-empty child class inside a zone — identifies the rendered component. */
function firstChildComponentClass(zoneEl: Element | null): string {
  if (!zoneEl) {
    return 'missing';
  }
  for (const child of zoneEl.children) {
    if (child instanceof HTMLElement && child.className && typeof child.className === 'string') {
      const cls = child.className.trim().split(/\s+/)[0];
      if (cls) {
        return `.${cls}`;
      }
    }
  }
  return zoneEl.children.length ? '(unclassed children)' : '(empty)';
}

/** Per-zone diagnostics: presence, bounding box, CSS owner, rendered component. */
export function readZoneDiagnostics(root: HTMLElement | null): LayoutZoneDiagnostic[] {
  if (!root || typeof window === 'undefined') {
    return [];
  }
  return LAYOUT_ZONES.map((zone) => {
    const zoneClass = LAYOUT_ZONE_CLASS[zone];
    const el = root.querySelector(`.${zoneClass}`);
    return {
      zone,
      zoneClass,
      present: Boolean(el),
      bounds: formatBounds(el?.getBoundingClientRect()),
      cssOwner: ZONE_CSS_OWNER[zone],
      renderedComponent: firstChildComponentClass(el),
    };
  });
}

function rectsOverlap(a: DOMRect, b: DOMRect): boolean {
  return a.top < b.bottom && a.bottom > b.top && a.left < b.right && a.right > b.left;
}

export function readLayoutDebugComputedSnapshot(root: HTMLElement | null): LayoutDebugComputedSnapshot | null {
  if (!root || typeof window === 'undefined') {
    return null;
  }
  const playerRow =
    root.querySelector('.bj-table-slot-row.bj-arc--player-boxes') ??
    root.querySelector('.bj-arc--player-boxes');
  const addBox =
    root.querySelector('.bj-table-slot-row__add') ??
    root.querySelector('.bj-player-boxes-wrap__add');
  const firstBox =
    root.querySelector('.bj-arc--player-boxes .bj-player-box-mobile') ??
    root.querySelector('.bj-arc--player-boxes .bj-phone-view__mini-hand--full-arc');
  const boxesZone = root.querySelector('.bj-table-zone--boxes');
  const trayZone = root.querySelector('.bj-table-zone--bottom');
  const canvas = root.querySelector('.bj-table-layout-shell');
  const styleOf = (el: Element | null) => (el ? window.getComputedStyle(el) : null);
  const playerRowStyle = styleOf(playerRow);
  const addBoxStyle = styleOf(addBox);
  const firstBoxStyle = styleOf(firstBox);
  const boxesZoneStyle = styleOf(boxesZone);
  const trayStyle = styleOf(trayZone);
  const canvasStyle = styleOf(canvas);

  const orderParts: string[] = [];
  if (playerRow) {
    for (const child of playerRow.children) {
      if (child.classList.contains('bj-table-slot-row__add') || child.classList.contains('bj-player-boxes-wrap__add')) {
        orderParts.push('+');
      } else if (child.classList.contains('bj-arc__slot')) {
        orderParts.push(`box-${orderParts.filter((p) => p.startsWith('box-')).length + 1}`);
      }
    }
  }

  const playerRowRect = playerRow?.getBoundingClientRect();
  const trayRect = trayZone?.getBoundingClientRect();
  const commandZone = root.querySelector('.bj-table-zone--summary');
  const cardsZone = root.querySelector('.bj-table-zone--cards.bj-cards-area--table');
  const cardsZoneStyle = styleOf(cardsZone);
  const commandRect = commandZone?.getBoundingClientRect();
  const cardsRect = cardsZone?.getBoundingClientRect();
  const boxesRect = boxesZone?.getBoundingClientRect();

  const cardStacks = root.querySelectorAll(
    '.bj-arc__cards-stack, .bj-arc__cards--stack-vertical, .bj-card-desktop-hero__cards',
  );
  const stackBounds = Array.from(cardStacks)
    .slice(0, 6)
    .map((el, i) => `stack${i + 1}:${formatBounds(el.getBoundingClientRect())}`)
    .join(' · ');

  const overlapWarnings: string[] = [];
  for (const stack of cardStacks) {
    const stackRect = stack.getBoundingClientRect();
    if (commandRect && rectsOverlap(stackRect, commandRect)) {
      overlapWarnings.push('cards-vs-command');
      break;
    }
  }
  for (const stack of cardStacks) {
    const stackRect = stack.getBoundingClientRect();
    if (boxesRect && rectsOverlap(stackRect, boxesRect)) {
      overlapWarnings.push('cards-vs-boxes');
      break;
    }
  }
  for (const stack of cardStacks) {
    const stackRect = stack.getBoundingClientRect();
    if (trayRect && rectsOverlap(stackRect, trayRect)) {
      overlapWarnings.push('cards-vs-tray');
      break;
    }
  }
  if (cardsRect && commandRect && cardsRect.top < commandRect.bottom - 2) {
    overlapWarnings.push('cards-zone-top-above-command-bottom');
  }

  const deviceView = root.getAttribute('data-device-view') ?? 'desktop';
  const viewMode = root.getAttribute('data-view-mode') ?? 'full';
  const layoutMode = resolveLayoutModeFromStrings(deviceView, viewMode);

  return {
    layoutMode,
    shellDisplay: canvasStyle?.display ?? 'n/a',
    shellGridRows: canvasStyle?.gridTemplateRows ?? 'n/a',
    zoneDiagnostics: readZoneDiagnostics(root),
    boxesRowDisplay: playerRowStyle?.display ?? 'n/a',
    boxesRowGridTemplate: playerRowStyle?.gridTemplateColumns ?? playerRowStyle?.flexDirection ?? 'n/a',
    addBoxWidth: addBoxStyle?.width ?? 'n/a',
    addBoxHeight: addBoxStyle?.height ?? 'n/a',
    firstBoxWidth: firstBoxStyle?.width ?? 'n/a',
    firstBoxHeight: firstBoxStyle?.height ?? 'n/a',
    boxesGap: playerRowStyle?.columnGap ?? playerRowStyle?.gap ?? 'n/a',
    boxesZoneOverflowX: boxesZoneStyle?.overflowX ?? 'n/a',
    boxesZoneOverflowY: boxesZoneStyle?.overflowY ?? 'n/a',
    trayPosition: trayStyle?.position ?? 'n/a',
    trayDisplay: trayStyle?.display ?? 'n/a',
    trayHeight: trayStyle?.height ?? 'n/a',
    trayPaddingBottom: trayStyle?.paddingBottom ?? 'n/a',
    canvasHeight: canvasStyle?.height ?? 'n/a',
    playerBoxDomOrder: orderParts.length ? orderParts.join(' → ') : playerRow ? 'row-without-slots' : 'missing',
    trayBounds: formatBounds(trayRect),
    playerRowBounds: formatBounds(playerRowRect),
    trayOverlapsPlayerRow: playerRowRect && trayRect ? rectsOverlap(playerRowRect, trayRect) : false,
    trayOverflowChain: readOverflowChain(trayZone),
    cardsZoneOverflow: cardsZoneStyle
      ? `ox=${cardsZoneStyle.overflowX} oy=${cardsZoneStyle.overflowY}`
      : 'n/a',
    cardStackBounds: stackBounds || 'n/a',
    overlapWarnings,
  };
}

export function logLayoutDebugChipTarget(details: Record<string, unknown>): void {
  if (!isVerboseDevLogging()) {
    return;
  }
  console.debug('[SXMCards][layout-debug][chip-target]', details);
}

export function logLayoutDebugSnapshot(snapshot: LayoutDebugComputedSnapshot): void {
  if (!isVerboseDevLogging()) {
    return;
  }
  console.debug('[SXMCards][layout-debug][computed]', snapshot);
}
