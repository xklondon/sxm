/** Dev-only layout zone overlay — enable with `?layoutDebug=1` in the URL. */
export const BLACKJACK_LAYOUT_DEBUG_PARAM = 'layoutDebug';

/** Build marker — confirms production bundle includes this audit pass. */
export const BLACKJACK_UI_FIX_VERSION = 'mobile-box-tray-audit-1';

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
}

export function readLayoutDebugComputedSnapshot(root: HTMLElement | null): LayoutDebugComputedSnapshot | null {
  if (!root || typeof window === 'undefined') {
    return null;
  }
  const boxesArc = root.querySelector('.bj-arc--player-boxes');
  const firstBox =
    root.querySelector('.bj-arc--player-boxes .bj-player-box-mobile') ??
    root.querySelector('.bj-arc--player-boxes .bj-phone-view__mini-hand--full-arc');
  const boxesZone = root.querySelector('.bj-table-zone--boxes');
  const trayZone = root.querySelector('.bj-table-zone--bottom');
  const canvas = root.querySelector('.bj-table-layout-shell');
  const addBtn = root.querySelector('.bj-player-boxes-wrap__add');
  const arc = root.querySelector('.bj-arc--player-boxes');
  const styleOf = (el: Element | null) => (el ? window.getComputedStyle(el) : null);
  const boxesArcStyle = styleOf(boxesArc);
  const firstBoxStyle = styleOf(firstBox);
  const boxesZoneStyle = styleOf(boxesZone);
  const trayStyle = styleOf(trayZone);
  const canvasStyle = styleOf(canvas);
  const orderParts: string[] = [];
  if (addBtn) {
    orderParts.push('+');
  }
  root.querySelectorAll('.bj-arc--player-boxes .bj-arc__slot').forEach((_slot, index) => {
    orderParts.push(`box-${index + 1}`);
  });
  return {
    boxesRowDisplay: boxesArcStyle?.display ?? 'n/a',
    boxesRowGridTemplate: boxesArcStyle?.gridTemplateColumns ?? boxesArcStyle?.flexDirection ?? 'n/a',
    firstBoxWidth: firstBoxStyle?.width ?? 'n/a',
    firstBoxHeight: firstBoxStyle?.height ?? 'n/a',
    boxesGap: boxesArcStyle?.columnGap ?? boxesArcStyle?.gap ?? 'n/a',
    boxesZoneOverflowX: boxesZoneStyle?.overflowX ?? 'n/a',
    boxesZoneOverflowY: boxesZoneStyle?.overflowY ?? 'n/a',
    trayPosition: trayStyle?.position ?? 'n/a',
    trayDisplay: trayStyle?.display ?? 'n/a',
    trayHeight: trayStyle?.height ?? 'n/a',
    trayPaddingBottom: trayStyle?.paddingBottom ?? 'n/a',
    canvasHeight: canvasStyle?.height ?? 'n/a',
    playerBoxDomOrder: orderParts.length ? orderParts.join(' → ') : arc ? 'arc-without-slots' : 'missing',
  };
}

export function logLayoutDebugChipTarget(details: Record<string, unknown>): void {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV === true) {
    console.debug('[SXMCards][layout-debug][chip-target]', details);
  }
}

export function logLayoutDebugSnapshot(snapshot: LayoutDebugComputedSnapshot): void {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV === true) {
    console.debug('[SXMCards][layout-debug][computed]', snapshot);
  }
}
