/**
 * Runtime visual branch audit — 1280×800 Playwright + Vite CSS (actual DOM/computed styles).
 * Usage: npx tsx scripts/runtime-visual-branch-audit.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { playingCardDesktopState } from '../src/test/cardDesktopLayoutState';
import { playingFullTableDesktopState } from '../src/test/fullTableDesktopLayoutState';
import { createNewBlackjackTable } from '../src/engine/session';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'reference-ui', 'captures', 'runtime-visual-branch-audit.json');

function bettingState(view: 'full' | 'card') {
  return {
    ...createNewBlackjackTable(),
    tableViewMode: view,
    blackjackFlowSettings: {
      initialDealMode: 'instant' as const,
      adviceEnabled: false,
      autoStandThreshold: 17,
      dealerHitsSoft17: true,
    },
  };
}

const AUDIT_JS = `(() => {
  const root = document.querySelector('.bj-casino');
  if (!root) return { error: 'no .bj-casino' };

  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      top: Math.round(r.top * 10) / 10,
      bottom: Math.round(r.bottom * 10) / 10,
      left: Math.round(r.left * 10) / 10,
      right: Math.round(r.right * 10) / 10,
      width: Math.round(r.width * 10) / 10,
      height: Math.round(r.height * 10) / 10,
    };
  };

  const stylePick = (el, keys) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    const o = {};
    for (const k of keys) o[k] = s[k];
    return o;
  };

  const domPath = (el) => {
    if (!el) return null;
    const parts = [];
    let n = el;
    while (n && n !== document.body && parts.length < 8) {
      let seg = n.tagName.toLowerCase();
      if (n.id) seg += '#' + n.id;
      if (n.className && typeof n.className === 'string') {
        const cls = n.className.trim().split(/\\s+/).slice(0, 3).join('.');
        if (cls) seg += '.' + cls;
      }
      parts.unshift(seg);
      n = n.parentElement;
    }
    return parts.join(' > ');
  };

  const feltSurface = root.querySelector('.bj-casino__felt.bj-table-surface, .bj-casino__felt');
  const dealerZone = root.querySelector('.bj-dealer-area, .bj-table-zone--dealer');
  const dealerCards = root.querySelector('.dealer-block__cards-slot');
  const dealBtn = root.querySelector('.dealer-block__action-slot button, .dealer-block__action-slot .ds-btn');
  const commandZone = root.querySelector('.bj-table-zone--summary');
  const commandPill = root.querySelector('.bj-card-layout__command, .dealer-block__command');
  const commandStatus = root.querySelector('.dealer-block__status, .bj-card-layout__command .dealer-block__status');
  const cardsZone = root.querySelector('.bj-table-zone--cards');
  const heroArea = cardsZone?.querySelector('.bj-card-desktop-hero');
  const heroCards = cardsZone?.querySelector('[data-layout-band="hero-cards"]');
  const heroCardEls = [...(cardsZone?.querySelectorAll('.bj-card-desktop-hero__card') ?? [])];
  const playingCards = [...(cardsZone?.querySelectorAll('.playing-card') ?? [])];
  const clothLayer = cardsZone?.querySelector('.bj-felt-cloth-layer');
  const actionsZone = root.querySelector('.bj-table-zone--actions');
  const actionRow = root.querySelector('.bj-table-zone--actions [data-layout-band="action-row"]');
  const hitBtn = root.querySelector('.ds-btn--hit, .bj-table-actions__btn--hit, [data-action="hit"]');
  const boxesZone = root.querySelector('.bj-table-zone--boxes');
  const slotRow = root.querySelector('.bj-arc--player-boxes, .bj-player-box-row');
  const slots = [...root.querySelectorAll('.bj-arc--player-boxes > .bj-arc__slot, .bj-player-box-row > .bj-arc__slot')];
  const plusBtn = root.querySelector('.bj-add-box-btn, .bj-player-boxes-wrap button[aria-label*="Add"], .bj-arc__add-box');
  const trayRow = root.querySelector('[data-layout-band="tray-row"]');
  const bottomZone = root.querySelector('.bj-table-zone--bottom');

  const slotData = slots.map((el, i) => ({
    i,
    className: el.className,
    rect: rect(el),
    styles: stylePick(el, ['width', 'height', 'flex', 'transform', 'marginLeft', 'marginTop']),
  }));

  const matchedRules = (el) => {
    if (!el) return [];
    const matched = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      if (!rules) continue;
      for (const rule of rules) {
        if (rule.type !== CSSRule.STYLE_RULE) continue;
        const sr = rule;
        try {
          if (el.matches(sr.selectorText)) matched.push(sr.selectorText);
        } catch { /* invalid selector */ }
      }
    }
    return matched.slice(-12);
  };

  const centerX = (el) => {
    const r = rect(el);
    return r ? Math.round((r.left + r.width / 2) * 10) / 10 : null;
  };

  const feltCenterX = centerX(feltSurface);

  return {
    root: {
      className: root.className,
      dataBjPhase: root.getAttribute('data-bj-phase'),
      dataBjView: root.getAttribute('data-bj-view'),
      dataViewMode: root.getAttribute('data-view-mode'),
      rect: rect(root),
    },
    feltSurface: {
      rect: rect(feltSurface),
      centerX: feltCenterX,
    },
    dealerZone: { rect: rect(dealerZone), domPath: domPath(dealerZone) },
    dealerCards: {
      rect: rect(dealerCards),
      centerX: centerX(dealerCards),
      deltaFromFeltCenter: (() => {
        const cx = centerX(dealerCards);
        return feltCenterX != null && cx != null
          ? Math.round((cx - feltCenterX) * 10) / 10
          : null;
      })(),
      domPath: domPath(dealerCards),
    },
    dealButton: {
      rect: rect(dealBtn),
      centerX: centerX(dealBtn),
      deltaFromFeltCenter: (() => {
        const cx = centerX(dealBtn);
        return feltCenterX != null && cx != null
          ? Math.round((cx - feltCenterX) * 10) / 10
          : null;
      })(),
      domPath: domPath(dealBtn),
      text: dealBtn?.textContent?.trim().slice(0, 40) ?? null,
      styles: stylePick(dealBtn, ['display', 'visibility', 'position', 'left', 'marginLeft']),
      matchedRules: matchedRules(dealBtn).filter((s) => /dealer|action-slot|deal/i.test(s)),
    },
    commandZone: {
      rect: rect(commandZone),
      domPath: domPath(commandZone),
      styles: stylePick(commandZone, ['height', 'paddingTop', 'paddingBottom', 'justifyContent']),
      matchedRules: matchedRules(commandZone).filter((s) => /summary|command|dealer-command-gap/i.test(s)).slice(-8),
    },
    commandPill: {
      rect: rect(commandPill),
      centerX: centerX(commandPill),
      domPath: domPath(commandPill),
      innerText: commandPill?.textContent?.trim().slice(0, 120) ?? null,
      styles: stylePick(commandPill, ['minHeight', 'padding', 'justifyContent', 'alignItems']),
    },
    commandStatus: { rect: rect(commandStatus), text: commandStatus?.textContent?.trim().slice(0, 80) ?? null },
    commandPillToDealGap: dealBtn && commandPill
      ? Math.round((commandPill.getBoundingClientRect().top - dealBtn.getBoundingClientRect().bottom) * 10) / 10
      : null,
    dealToCommandZoneTopGap: dealBtn && commandZone
      ? Math.round((commandZone.getBoundingClientRect().top - dealBtn.getBoundingClientRect().bottom) * 10) / 10
      : null,
    cardsZone: {
      rect: rect(cardsZone),
      className: cardsZone?.className ?? null,
      domPath: domPath(cardsZone),
    },
    heroArea: {
      present: !!heroArea,
      rect: rect(heroArea),
      domPath: domPath(heroArea),
      innerHTMLSnippet: heroArea?.innerHTML.slice(0, 400) ?? null,
      styles: stylePick(heroArea, ['display', 'visibility', 'opacity', 'overflow', 'zIndex', 'height']),
    },
    heroCards: {
      rect: rect(heroCards),
      cardCount: heroCardEls.length,
      playingCardCount: playingCards.length,
      cardRects: heroCardEls.map((c) => rect(c)),
      cardStyles: heroCardEls.map((c) =>
        stylePick(c, ['display', 'visibility', 'opacity', 'width', 'height', 'maxHeight', 'zIndex', 'overflow']),
      ),
      playingCardStyles: playingCards.slice(0, 3).map((c) =>
        stylePick(c, ['display', 'visibility', 'opacity', 'width', 'height', 'maxHeight', 'zIndex']),
      ),
    },
    clothLayer: {
      rect: rect(clothLayer),
      styles: stylePick(clothLayer, ['opacity', 'zIndex', 'alignItems', 'pointerEvents']),
    },
    cardsZoneChildren: cardsZone
      ? [...cardsZone.children].map((c) => ({
          tag: c.tagName,
          className: c.className,
          rect: rect(c),
          zIndex: getComputedStyle(c).zIndex,
        }))
      : [],
    actionsZone: { rect: rect(actionsZone), domPath: domPath(actionsZone) },
    actionRow: {
      rect: rect(actionRow),
      domPath: domPath(actionRow),
      className: actionRow?.className ?? null,
      dataActionRowScale: actionRow?.getAttribute('data-action-row-scale') ?? null,
      innerHTMLSnippet: actionRow?.innerHTML.slice(0, 500) ?? null,
      styles: stylePick(actionRow, ['display', 'visibility', 'minHeight', 'height']),
      matchedRules: matchedRules(actionRow).filter((s) => /action-row|actions/i.test(s)).slice(-8),
    },
    hitStay: {
      hitRect: rect(hitBtn),
      hitDomPath: domPath(hitBtn),
      hitClass: hitBtn?.className ?? null,
      actionButtonsRow: root.querySelector('.bj-table-actions__row')?.className ?? null,
    },
    boxesZone: { rect: rect(boxesZone), domPath: domPath(boxesZone) },
    slotRow: { rect: rect(slotRow), className: slotRow?.className ?? null },
    slots: slotData,
    plusButton: { rect: rect(plusBtn), domPath: domPath(plusBtn) },
    trayRow: { rect: rect(trayRow) },
    bottomZone: { rect: rect(bottomZone) },
  };
})()`;

type AuditRow = {
  dealButton?: {
    rect?: { top?: number; bottom?: number; left?: number } | null;
    centerX?: number | null;
    deltaFromFeltCenter?: number | null;
  };
  dealerCards?: {
    centerX?: number | null;
    deltaFromFeltCenter?: number | null;
  };
  commandPill?: { rect?: { top?: number; bottom?: number } | null };
  commandPillToDealGap?: number | null;
  dealToCommandZoneTopGap?: number | null;
  slots?: Array<{ rect?: { top?: number; height?: number } | null }>;
  heroCards?: {
    cardCount?: number;
    cardRects?: Array<{ top?: number; bottom?: number; width?: number; height?: number } | null>;
  };
  heroArea?: { present?: boolean };
  cardsZone?: { rect?: { top?: number; bottom?: number } | null };
  clothLayer?: { styles?: { zIndex?: string } | null };
  actionRow?: {
    dataActionRowScale?: string | null;
    innerHTMLSnippet?: string | null;
  };
};

function assertAudit(report: Record<string, AuditRow>) {
  const fullBet = report.A_full_betting;
  const fullPlay = report.A_full_playing;
  const cardBet = report.B_card_betting;
  const cardPlay = report.C_card_playing;

  if (!fullBet?.dealButton?.rect || !fullBet?.commandPill?.rect || !cardBet?.dealButton?.rect || !cardBet?.commandPill?.rect) {
    throw new Error('Missing full/card betting deal/command rects');
  }
  const fullBetDealBottom = fullBet.dealButton?.rect?.bottom;
  const fullBetCmdTop = fullBet.commandPill?.rect?.top;
  const cardBetDealBottom = cardBet.dealButton?.rect?.bottom;
  const cardBetCmdTop = cardBet.commandPill?.rect?.top;
  if (fullBetDealBottom != null && fullBetCmdTop != null && fullBetDealBottom > fullBetCmdTop) {
    throw new Error(
      `Full betting deal overlaps command pill (deal bottom ${fullBetDealBottom} > pill top ${fullBetCmdTop})`,
    );
  }
  for (const [label, fullVal, cardVal] of [
    ['betting dealer cards cx', fullBet.dealerCards?.centerX, cardBet.dealerCards?.centerX],
    ['betting deal cx', fullBet.dealButton?.centerX, cardBet.dealButton?.centerX],
    ['betting command top', fullBet.commandPill?.rect?.top, cardBet.commandPill?.rect?.top],
    ['betting command cx', fullBet.commandPill?.centerX, cardBet.commandPill?.centerX],
  ] as const) {
    if (fullVal == null || cardVal == null) throw new Error(`Missing ${label} measurement`);
    if (Math.abs(Number(fullVal) - Number(cardVal)) > 5) {
      throw new Error(`Full vs Card betting ${label} delta ${Math.abs(Number(fullVal) - Number(cardVal))}px exceeds 5px`);
    }
  }

  if (fullBetDealBottom != null && fullBetCmdTop != null && cardBetDealBottom != null && cardBetCmdTop != null) {
    const fullGap = fullBetCmdTop - fullBetDealBottom;
    const cardGap = cardBetCmdTop - cardBetDealBottom;
    if (Math.abs(fullGap - cardGap) > 5) {
      throw new Error(`Full vs Card betting deal→command gap delta ${Math.abs(fullGap - cardGap)}px exceeds 5px`);
    }
  }
  for (const [label, row] of [
    ['Card View betting dealer cards', cardBet],
    ['Card View playing dealer cards', cardPlay],
  ] as const) {
    if (!row) throw new Error(`Missing audit row for ${label}`);
    for (const [part, delta] of [
      ['dealer cards', row.dealerCards?.deltaFromFeltCenter],
      ['deal button', row.dealButton?.deltaFromFeltCenter],
    ] as const) {
      if (delta == null) throw new Error(`${label}: missing ${part} felt-center delta`);
      if (Math.abs(delta) > 5) {
        throw new Error(`${label}: ${part} off felt center by ${Math.abs(delta)}px (>5px)`);
      }
    }
  }

  for (const phase of ['betting', 'playing'] as const) {
    const full = phase === 'betting' ? fullBet : fullPlay;
    const card = phase === 'betting' ? cardBet : report.D_card_playing_actions;
    const fs = full?.slots?.[0]?.rect;
    const cs = card?.slots?.[0]?.rect;
    if (!fs || !cs) throw new Error(`Missing slot[0] for ${phase}`);
    if (Math.abs(fs.top! - cs.top!) > 4) {
      throw new Error(`Box slot top ${phase}: full ${fs.top} vs card ${cs.top} (>4px)`);
    }
    if (Math.abs(fs.height! - cs.height!) > 4) {
      throw new Error(`Box slot height ${phase}: full ${fs.height} vs card ${cs.height} (>4px)`);
    }
  }

  const hero = cardPlay?.heroCards;
  const cardsZone = cardPlay?.cardsZone?.rect;
  if (!cardPlay?.heroArea?.present || !hero || hero.cardCount! < 1) {
    throw new Error('Card View playing missing hero cards');
  }
  for (const [i, cr] of (hero.cardRects ?? []).entries()) {
    if (!cr) continue;
    if (cr.width! < 90 || cr.height! < 125) {
      throw new Error(`Hero card ${i} too small (${cr.width}x${cr.height}, need >=90x125)`);
    }
    if (cardsZone && cr.top! < cardsZone.top! - 1) {
      throw new Error(`Hero card ${i} above cardsArea`);
    }
    if (cardsZone && cr.bottom! > cardsZone.bottom! + 1) {
      throw new Error(`Hero card ${i} below cardsArea`);
    }
  }
  const clothLayer = cardPlay?.clothLayer;
  const clothZ = Number(clothLayer?.styles?.zIndex ?? 0);
  if (clothZ >= 1) {
    throw new Error('Cloth z-index must stay below hero cards');
  }

  const fullAction = report.D_full_playing_actions?.actionRow?.innerHTMLSnippet ?? '';
  const cardAction = report.D_card_playing_actions?.actionRow?.innerHTMLSnippet ?? '';
  if (fullAction !== cardAction) {
    throw new Error('Full Table and Card View action innerHTML differ');
  }
  if (fullAction.includes('bj-phone-view__action-bar-extra')) {
    throw new Error('Desktop action row still contains bj-phone-view__action-bar-extra');
  }
  if (report.D_full_playing_actions?.actionRow?.dataActionRowScale !== 'full-table') {
    throw new Error('Full Table action scale must be full-table');
  }
  if (report.D_card_playing_actions?.actionRow?.dataActionRowScale !== 'full-table') {
    throw new Error('Card View action scale must be full-table');
  }

  console.log('Runtime visual branch audit: all assertions passed');
}

async function main() {
  mkdirSync(dirname(OUT), { recursive: true });
  const server = await createServer({
    configFile: join(__dirname, '..', 'vite.config.ts'),
    server: { port: 5197, strictPort: true },
  });
  await server.listen();
  const { BlackjackPanel } = await server.ssrLoadModule('/src/components/BlackjackPanel.tsx');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const scenarios = [
    ['A_full_betting', bettingState('full')],
    ['A_full_playing', playingFullTableDesktopState()],
    ['B_card_betting', bettingState('card')],
    ['B_full_betting_ref', bettingState('full')],
    ['C_card_playing', playingCardDesktopState()],
    ['D_full_playing_actions', playingFullTableDesktopState()],
    ['D_card_playing_actions', playingCardDesktopState()],
  ] as const;

  const report: Record<string, unknown> = {};

  for (const [key, state] of scenarios) {
    const html = renderToString(
      createElement(BlackjackPanel, { gameState: state, onGameStateChange: () => undefined }),
    );
    await page.setContent(
      `<!DOCTYPE html><html><head><meta charset="utf-8" />
<link rel="stylesheet" href="http://127.0.0.1:5197/src/index.css" />
<style>
  html,body,#root{margin:0;min-height:100vh;background:#0a1a12}
  .bj-side-rail{display:none!important}
  .bj-casino__this-table--dock{display:none!important}
  #root{display:flex;justify-content:center;padding:0.5rem}
</style></head><body><div id="root">${html}</div></body></html>`,
      { waitUntil: 'networkidle' },
    );
    await page.waitForTimeout(600);
    report[key] = await page.evaluate(AUDIT_JS);
    console.log(`\n======== ${key} ========`);
    console.log(JSON.stringify(report[key], null, 2));
  }

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('\nWrote', OUT);

  assertAudit(report as Record<string, AuditRow>);

  await browser.close();
  await server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
