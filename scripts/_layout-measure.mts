import { createServer } from 'vite';
import { chromium } from 'playwright';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNewBlackjackTable } from '../src/engine/session';
import { playingCardDesktopState } from '../src/test/cardDesktopLayoutState';
import { playingFullTableDesktopState } from '../src/test/fullTableDesktopLayoutState';

const __dirname = dirname(fileURLToPath(import.meta.url));

function bettingState(view: 'full' | 'card') {
  return { ...createNewBlackjackTable(), tableViewMode: view };
}

function mobileBettingState(view: 'full' | 'card') {
  return { ...createNewBlackjackTable(), tableViewMode: view };
}

function mobilePlayingState(view: 'full' | 'card') {
  const base = view === 'card' ? playingCardDesktopState() : playingFullTableDesktopState();
  return { ...base, tableViewMode: view };
}

const MEASURE = `(() => {
  const rect = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return {
      top: Math.round(b.top * 10) / 10,
      bottom: Math.round(b.bottom * 10) / 10,
      left: Math.round(b.left * 10) / 10,
      right: Math.round(b.right * 10) / 10,
      width: Math.round(b.width * 10) / 10,
      height: Math.round(b.height * 10) / 10,
      cx: Math.round((b.left + b.width / 2) * 10) / 10,
    };
  };
  const felt = document.querySelector('.bj-casino__felt.bj-table-surface, .bj-casino__felt');
  const dealerCards = document.querySelector('.dealer-block__cards-slot');
  const deal = document.querySelector('.dealer-block__action-slot button, .dealer-block__action-slot .ds-btn');
  const cmd = document.querySelector('.dealer-block__command, .bj-card-layout__command');
  const cmdZone = document.querySelector('.bj-table-zone--summary');
  const cardsZone = document.querySelector('.bj-table-zone--cards');
  const boxes = document.querySelector('.bj-table-zone--boxes');
  const tray = document.querySelector('[data-layout-band="tray-row"]');
  const slots = [...document.querySelectorAll('.bj-arc--player-boxes > .bj-arc__slot, .bj-player-box-row > .bj-arc__slot')];
  const heroCards = [...document.querySelectorAll('.bj-card-desktop-hero__card, .bj-phone-view__cards .playing-card.bj-phone-card--hero, .bj-phone-view__cards .playing-card.ds-card--hero')];
  const heroValue = document.querySelector('.bj-card-view__hero-value, .bj-phone-view__total--hero, .bj-phone-view__hand-meta');
  const boxValues = [...document.querySelectorAll('.bj-phone-view__mini-hand-value, .bj-player-hand-value')];
  return {
    felt: rect(felt),
    dealerCards: rect(dealerCards),
    dealButton: rect(deal),
    commandPill: rect(cmd),
    commandZone: rect(cmdZone),
    dealToCmdGap: deal && cmd ? Math.round((cmd.top - deal.bottom) * 10) / 10 : null,
    cardsZone: rect(cardsZone),
    boxesZone: rect(boxes),
    trayRow: rect(tray),
    slotCenters: slots.map((s, i) => ({ i, cx: rect(s)?.cx })),
    heroCards: heroCards.map(rect),
    heroValue: heroValue ? { ...rect(heroValue), display: getComputedStyle(heroValue).display, visibility: getComputedStyle(heroValue).visibility } : null,
    boxValueSample: boxValues[0]
      ? {
          ...rect(boxValues[0]),
          fontSize: getComputedStyle(boxValues[0]).fontSize,
        }
      : null,
  };
})()`;

function installMobileWindow() {
  (globalThis as { window?: Window }).window = {
    innerWidth: 390,
    innerHeight: 844,
    matchMedia: (query: string) => {
      const m = /max-width:\s*(\d+)/.exec(query);
      const matches = m ? 390 <= Number(m[1]) : query.includes('portrait');
      return {
        matches,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      };
    },
  } as unknown as Window;
}

async function main() {
  const viewportArg = process.argv[2] ?? 'desktop';
  const viewport =
    viewportArg === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 800 };

  const server = await createServer({
    configFile: join(__dirname, '..', 'vite.config.ts'),
    server: { port: 5210, strictPort: true },
  });
  await server.listen();
  const { BlackjackPanel } = await server.ssrLoadModule('/src/components/BlackjackPanel.tsx');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });

  const scenarios =
    viewportArg === 'mobile'
      ? [
          ['M_full_betting', mobileBettingState('full')],
          ['M_card_betting', mobileBettingState('card')],
          ['M_full_playing', mobilePlayingState('full')],
          ['M_card_playing', mobilePlayingState('card')],
        ]
      : [
          ['D_full_betting', bettingState('full')],
          ['D_card_betting', bettingState('card')],
        ];

  for (const [label, state] of scenarios) {
    if (viewportArg === 'mobile') installMobileWindow();
    const html = renderToString(
      createElement(BlackjackPanel, { gameState: state, onGameStateChange: () => undefined }),
    );
    if (viewportArg === 'mobile') delete (globalThis as { window?: Window }).window;
    await page.setContent(
      `<!DOCTYPE html><html><head><link rel="stylesheet" href="http://127.0.0.1:5210/src/index.css" /></head><body><div id="root">${html}</div></body></html>`,
      { waitUntil: 'networkidle' },
    );
    await page.waitForTimeout(500);
    const m = await page.evaluate(MEASURE);
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify(m, null, 2));
  }

  await browser.close();
  await server.close();
}

main();
