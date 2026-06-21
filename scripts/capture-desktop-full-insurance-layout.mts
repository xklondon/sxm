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
const OUT_FILE = join(OUT_DIR, 'Desktop_Full_Insurance_bounding_boxes.json');

function installDesktopWindow() {
  (globalThis as { window?: Window }).window = {
    innerWidth: 1280,
    innerHeight: 800,
    matchMedia: (query: string) => {
      const m = /max-width:\s*(\d+)/.exec(query);
      const matches = m ? 1280 <= Number(m[1]) : false;
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

function insuranceState(): GameState {
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
  return {
    ...state,
    blackjack: round,
    tableViewMode: 'full',
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
      adviceEnabled: false,
    },
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const server = await createServer({
    configFile: join(__dirname, '..', 'vite.config.ts'),
    server: { port: 5201, strictPort: true },
  });
  await server.listen();

  installDesktopWindow();
  const { BlackjackPanel } = await server.ssrLoadModule('/src/components/BlackjackPanel.tsx');
  const panelHtml = renderToString(
    createElement(BlackjackPanel, {
      gameState: insuranceState(),
      onGameStateChange: () => undefined,
    }),
  );
  delete (globalThis as { window?: Window }).window;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.setContent(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="http://127.0.0.1:5201/src/index.css" />
  <style>
    html, body, #root { margin: 0; height: 800px; max-height: 800px; min-height: 800px; overflow: hidden; background: #0a1a12; }
    .bj-casino { max-width: 1280px; margin: 0 auto; }
    .bj-side-rail { display: none !important; }
  </style>
</head>
<body>
  <div id="root">${panelHtml}</div>
</body>
</html>`,
    { waitUntil: 'networkidle' },
  );
  await page.waitForTimeout(400);

  const boxes = await page.evaluate(`(() => {
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
        overflow: style.overflow,
        zIndex: style.zIndex,
      };
    };
    const cardsArea = document.querySelector('.bj-view-full-desktop .bj-table-zone--cards');
    const cardStacks = [...document.querySelectorAll('.bj-view-full-desktop .bj-table-zone--cards .playing-card')].map((el, i) => {
      const r = el.getBoundingClientRect();
      return { i, top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width };
    });
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      dataPhase: document.querySelector('.bj-casino')?.getAttribute('data-phase') ?? null,
      dataBjPhase: document.querySelector('.bj-casino')?.getAttribute('data-bj-phase') ?? null,
      dealerArea: rect(document.querySelector('.bj-view-full-desktop .bj-dealer-area')),
      commandZone: rect(document.querySelector('.bj-view-full-desktop .bj-table-zone--summary')),
      commandBox: rect(document.querySelector('.bj-view-full-desktop .bj-card-layout__command')),
      overlay: rect(document.querySelector('.bj-insurance-overlay')),
      cardsArea: rect(cardsArea),
      feltCloth: rect(document.querySelector('.bj-view-full-desktop .bj-felt-cloth-layer')),
      cardStacks,
    };
  })()`);

  writeFileSync(OUT_FILE, JSON.stringify(boxes, null, 2));

  await browser.close();
  await server.close();

  console.log('Desktop Full Insurance bounding boxes:', OUT_FILE);
  console.log(JSON.stringify(boxes, null, 2));

  const capture = boxes as {
    dataPhase: string | null;
    cardsArea: { top: number; bottom: number } | null;
    overlay: { top: number; bottom: number } | null;
    cardStacks: Array<{ top: number; bottom: number }>;
  };

  if (capture.dataPhase !== 'insurance') {
    throw new Error(`expected insurance phase, got ${capture.dataPhase}`);
  }
  if (!capture.cardsArea || !capture.overlay) {
    throw new Error('missing cardsArea or insurance overlay');
  }
  if (capture.cardStacks.length === 0) {
    throw new Error('expected visible player cards in cardsArea during insurance');
  }

  for (const stack of capture.cardStacks) {
    if (stack.top < capture.cardsArea.top + 2) {
      throw new Error(`card stack top ${stack.top} clipped above cardsArea ${capture.cardsArea.top}`);
    }
    if (stack.bottom > capture.cardsArea.bottom - 2) {
      throw new Error(`card stack bottom ${stack.bottom} clipped below cardsArea ${capture.cardsArea.bottom}`);
    }
    const overlapsOverlay =
      stack.bottom > capture.overlay.top + 2 && stack.top < capture.overlay.bottom - 2;
    if (overlapsOverlay) {
      throw new Error('insurance overlay overlaps visible card stack');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
