import { writeFileSync, mkdirSync } from 'node:fs';
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
const OUT = join(__dirname, '..', 'reference-ui', 'captures', 'desktop-polish-measurements.json');

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

async function measure(page: import('playwright').Page, rootSel: string) {
  return page.evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify(rootSel)});
    if (!root) return null;
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), height: Math.round(r.height), width: Math.round(r.width) };
    };
    const q = (band) => root.querySelector('[data-layout-band="' + band + '"]');
    const dealBtn = root.querySelector('.dealer-block__action-slot button, .dealer-block__action-slot .ds-btn');
    const clothTitle = root.querySelector('.bj-felt-cloth-layer__title');
    const slots = [...root.querySelectorAll('.bj-arc--player-boxes > .bj-arc__slot')].map((el, i) => {
      const r = el.getBoundingClientRect();
      return { i, left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), center: Math.round(r.left + r.width / 2) };
    });
    return {
      layoutPhase: root.getAttribute('data-bj-phase'),
      bjView: root.getAttribute('data-bj-view'),
      felt: rect(root.querySelector('.bj-casino__felt')),
      clothLayer: rect(root.querySelector('.bj-felt-cloth-layer')),
      clothTitle: rect(clothTitle),
      command: rect(root.querySelector('.bj-table-zone--summary')),
      commandPill: rect(root.querySelector('.bj-card-layout__command, .dealer-block__command')),
      dealer: rect(root.querySelector('.bj-dealer-area, .bj-table-zone--dealer')),
      dealButton: rect(dealBtn),
      cardsZone: rect(root.querySelector('.bj-table-zone--cards')),
      heroCards: rect(q('hero-cards')),
      heroValue: rect(q('hero-value')),
      actionRow: rect(root.querySelector('.bj-table-zone--actions [data-layout-band="action-row"]')),
      actionZone: rect(root.querySelector('.bj-table-zone--actions')),
      actionButtons: rect(root.querySelector('[data-layout-band="action-row"] .bj-table-actions__row, [data-layout-band="action-row"] .ds-btn--hit')),
      boxesZone: rect(root.querySelector('.bj-table-zone--boxes')),
      trayRow: rect(q('tray-row')),
      bottomZone: rect(root.querySelector('.bj-table-zone--bottom')),
      trayLabel: rect(root.querySelector('.bj-value-chips__row--label')),
      slots,
    };
  })()`);
}

const server = await createServer({
  configFile: join(__dirname, '..', 'vite.config.ts'),
  server: { port: 5192, strictPort: true },
});
await server.listen();
const { BlackjackPanel } = await server.ssrLoadModule('/src/components/BlackjackPanel.tsx');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const out: Record<string, unknown> = {};

for (const [key, state] of [
  ['full-betting', bettingState('full')],
  ['full-playing', playingFullTableDesktopState()],
  ['card-betting', bettingState('card')],
  ['card-playing', playingCardDesktopState()],
] as const) {
  const html = renderToString(
    createElement(BlackjackPanel, { gameState: state, onGameStateChange: () => undefined }),
  );
  await page.setContent(
    `<!DOCTYPE html><html><head><meta charset="utf-8" />
<link rel="stylesheet" href="http://127.0.0.1:5192/src/index.css" />
<style>html,body,#root{margin:0;min-height:100vh;background:#0a1a12}.bj-side-rail{display:none!important}.bj-casino__this-table--dock{display:none!important}#root{display:flex;justify-content:center;padding:0.5rem}</style>
</head><body><div id="root">${html}</div></body></html>`,
    { waitUntil: 'networkidle' },
  );
  await page.waitForTimeout(500);
  const rootSel =
    key.startsWith('full') ? '.bj-view-full-desktop' : '.bj-view-card-desktop';
  out[key] = await measure(page, rootSel);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log('Wrote', OUT);

const PARITY_TOL = 1;
const PHASE_PARITY_BANDS = ['cardsZone', 'actionZone', 'boxesZone', 'trayRow', 'commandPill', 'dealer'] as const;

for (const [fullKey, cardKey] of [
  ['full-betting', 'card-betting'],
  ['full-playing', 'card-playing'],
] as const) {
  const full = out[fullKey] as Record<string, { top?: number; bottom?: number; height?: number } | null>;
  const card = out[cardKey] as Record<string, { top?: number; bottom?: number; height?: number } | null>;
  for (const band of PHASE_PARITY_BANDS) {
    const ft = full[band]?.top;
    const ct = card[band]?.top;
    if (ft == null || ct == null) continue;
    if (Math.abs(ft - ct) > PARITY_TOL) {
      throw new Error(
        `Desktop parity: ${band}.top ${fullKey}=${ft} vs ${cardKey}=${ct} (tol ${PARITY_TOL}px)`,
      );
    }
  }
  const fSlots = (full as { slots?: Array<{ center: number }> }).slots ?? [];
  const cSlots = (card as { slots?: Array<{ center: number }> }).slots ?? [];
  if (fSlots.length === cSlots.length) {
    for (let i = 0; i < fSlots.length; i++) {
      if (Math.abs(fSlots[i].center - cSlots[i].center) > PARITY_TOL) {
        throw new Error(
          `Desktop parity: slot ${i} center ${fullKey}=${fSlots[i].center} vs ${cardKey}=${cSlots[i].center}`,
        );
      }
    }
  }
}

for (const view of ['full', 'card'] as const) {
  const betting = out[`${view}-betting`] as Record<string, { top?: number; bottom?: number; height?: number } | null>;
  const playing = out[`${view}-playing`] as Record<string, { top?: number; bottom?: number; height?: number } | null>;
  for (const band of PHASE_PARITY_BANDS) {
    const bt = betting[band]?.top;
    const pt = playing[band]?.top;
    const bb = betting[band]?.bottom;
    const pb = playing[band]?.bottom;
    const bh = betting[band]?.height;
    const ph = playing[band]?.height;
    if (bt == null || pt == null) continue;
    if (Math.abs(bt - pt) > PARITY_TOL) {
      throw new Error(
        `Phase parity ${view}: ${band}.top betting=${bt} vs playing=${pt} (tol ${PARITY_TOL}px)`,
      );
    }
    if (bb != null && pb != null && Math.abs(bb - pb) > PARITY_TOL) {
      throw new Error(
        `Phase parity ${view}: ${band}.bottom betting=${bb} vs playing=${pb} (tol ${PARITY_TOL}px)`,
      );
    }
    if (bh != null && ph != null && Math.abs(bh - ph) > PARITY_TOL) {
      throw new Error(
        `Phase parity ${view}: ${band}.height betting=${bh} vs playing=${ph} (tol ${PARITY_TOL}px)`,
      );
    }
  }
}

const ALL_KEYS = ['full-betting', 'full-playing', 'card-betting', 'card-playing'] as const;
for (const band of ['boxesZone', 'trayRow', 'cardsZone', 'actionZone'] as const) {
  const tops = ALL_KEYS.map(
    (k) => (out[k] as Record<string, { top?: number } | null>)?.[band]?.top,
  ).filter((v): v is number => v != null);
  const bottoms = ALL_KEYS.map(
    (k) => (out[k] as Record<string, { bottom?: number } | null>)?.[band]?.bottom,
  ).filter((v): v is number => v != null);
  if (tops.length === ALL_KEYS.length && Math.max(...tops) - Math.min(...tops) > PARITY_TOL) {
    throw new Error(
      `Cross-view ${band}.top spread ${Math.max(...tops) - Math.min(...tops)}px exceeds ${PARITY_TOL}px`,
    );
  }
  if (bottoms.length === ALL_KEYS.length && Math.max(...bottoms) - Math.min(...bottoms) > PARITY_TOL) {
    throw new Error(
      `Cross-view ${band}.bottom spread ${Math.max(...bottoms) - Math.min(...bottoms)}px exceeds ${PARITY_TOL}px`,
    );
  }
}

console.log(JSON.stringify(out, null, 2));

await browser.close();
await server.close();
