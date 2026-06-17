/** Dev-only layout zone overlay — enable with `?layoutDebug=1` in the URL. */
import { isVerboseDevLogging } from '../utils/devFlags';

export const BLACKJACK_LAYOUT_DEBUG_PARAM = 'layoutDebug';
/** Build marker — confirms production bundle includes this audit pass. */
export const BLACKJACK_UI_FIX_VERSION = 'mobile-box-tray-final-2';

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

export interface LayoutDebugComputedSnapshot {
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

  return {
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
