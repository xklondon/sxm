import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import type { BlackjackRound, GameState } from '../src/types';
import {
  actingRound,
  boxPlayerId,
  findCardId,
  tableWithClaimedBox,
} from '../src/engine/blackjack/sanity/fixtures';
import { addChipToBoxStake, confirmBoxStake } from '../src/engine/blackjack';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'reference-ui', 'captures');
const OUT_FILE = join(OUT_DIR, 'Mobile_Insurance_bounding_boxes.json');

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

function insuranceState(viewMode: 'full' | 'card'): GameState {
  let state = tableWithClaimedBox(1);
  const boxId = boxPlayerId(state, 1)!;
  const personId = state.tableMeta.ownerPersonId!;
  state = addChipToBoxStake(state, boxId, 50, personId);
  state = confirmBoxStake(state, boxId);
  const aceId = findCardId(state.deck!, 'A');
  const holeId = findCardId(state.deck!, '9');
  const round: BlackjackRound = {
    ...actingRound(state, boxId, [findCardId(state.deck!, '10'), findCardId(state.deck!, '9')], 50),
    status: 'player-turns',
    insuranceOfferPending: true,
    dealerCardIds: [aceId, holeId],
    dealerHoleHidden: true,
    activeHandKey: null,
    activePlayerId: null,
  };
  return { ...state, blackjack: round, tableViewMode: viewMode };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const server = await createServer({
    configFile: join(__dirname, '..', 'vite.config.ts'),
    server: { port: 5200, strictPort: true },
  });
  await server.listen();

  installMobileWindow();
  const { BlackjackPanel } = await server.ssrLoadModule('/src/components/BlackjackPanel.tsx');
  const fullHtml = renderToString(
    createElement(BlackjackPanel, {
      gameState: insuranceState('full'),
      onGameStateChange: () => undefined,
    }),
  );
  const cardHtml = renderToString(
    createElement(BlackjackPanel, {
      gameState: insuranceState('card'),
      onGameStateChange: () => undefined,
    }),
  );
  delete (globalThis as { window?: Window }).window;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  async function capture(label: 'full' | 'card', html: string) {
    await page.setContent(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="http://127.0.0.1:5200/src/index.css" />
  <style>
    html, body, #root { margin: 0; height: 844px; max-height: 844px; min-height: 844px; overflow: hidden; background: #0a1a12; }
    .bj-casino { max-width: 390px; margin: 0 auto; }
    .bj-side-rail { display: none !important; }
  </style>
</head>
<body>
  <div id="root">${html}</div>
</body>
</html>`,
      { waitUntil: 'networkidle' },
    );
    await page.waitForTimeout(400);

    return page.evaluate(`(() => {
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          top: r.top,
          bottom: r.bottom,
          left: r.left,
          right: r.right,
          width: r.width,
          height: r.height,
          display: style.display,
          visibility: style.visibility,
          overflow: style.overflow,
          zIndex: style.zIndex,
        };
      };
      const overlay = document.querySelector('.bj-insurance-overlay');
      const summary = document.querySelector('.bj-table-zone--summary');
      const buttons = [...document.querySelectorAll('.bj-insurance-overlay__btn')].map((btn, i) => {
        const r = btn.getBoundingClientRect();
        return { i, label: btn.textContent?.trim() ?? '', top: r.top, bottom: r.bottom, height: r.height };
      });
      return {
        view: '${label}',
        viewport: { width: window.innerWidth, height: window.innerHeight },
        dataPhase: document.querySelector('.bj-casino')?.getAttribute('data-phase') ?? null,
        summaryZone: rect(summary),
        overlay: rect(overlay),
        buttons,
      };
    })()`);
  }

  const full = await capture('full', fullHtml);
  const card = await capture('card', cardHtml);
  const boxes = { full, card };
  writeFileSync(OUT_FILE, JSON.stringify(boxes, null, 2));

  await browser.close();
  await server.close();

  console.log('Mobile Insurance bounding boxes:', OUT_FILE);
  console.log(JSON.stringify(boxes, null, 2));

  for (const phase of [full, card] as Array<{
    view: string;
    dataPhase: string | null;
    overlay: { top: number; bottom: number; height: number } | null;
    buttons: { bottom: number; height: number }[];
    viewport: { height: number };
  }>) {
    if (phase.dataPhase !== 'insurance') {
      throw new Error(`expected insurance phase for ${phase.view}, got ${phase.dataPhase}`);
    }
    if (!phase.overlay || phase.overlay.height < 40) {
      throw new Error(`insurance overlay not visible for ${phase.view}`);
    }
    if (phase.overlay.bottom > phase.viewport.height + 2) {
      throw new Error(`insurance overlay clipped below viewport for ${phase.view}`);
    }
    if (phase.overlay.top < 0) {
      throw new Error(`insurance overlay clipped above viewport for ${phase.view}`);
    }
    for (const btn of phase.buttons) {
      if (btn.height < 36 || btn.bottom > phase.viewport.height + 2) {
        throw new Error(`insurance button clipped for ${phase.view}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
