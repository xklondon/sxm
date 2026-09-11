import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { playingCardDesktopState } from '../src/test/cardDesktopLayoutState';
import { boxPlayerId, findCardId, tableAfterStartPlaying } from '../src/engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../src/engine/session';
import { addChipToBoxStake } from '../src/engine/blackjack';
import { createBlackjackPlayerHand } from '../src/types/blackjack';
import { blackjackHandKey } from '../src/engine/blackjack';
import type { GameState } from '../src/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'reference-ui', 'captures');
const OUT_BEFORE = join(OUT_DIR, 'Mobile_Card_bounding_boxes_before.json');
const OUT_AFTER = join(OUT_DIR, 'Mobile_Card_bounding_boxes.json');

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

function mobileViewState(cardCount: 2 | 3 | 4, tableViewMode: 'card' | 'full'): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const deck = state.deck!;
  const box1 = boxPlayerId(state, 1)!;
  const k1 = blackjackHandKey(box1, 0);
  state = addChipToBoxStake(state, box1, 20);
  const ranks = ['6', '7', '8', '9'] as const;
  const cardIds = ranks.slice(0, cardCount).map((rank) => findCardId(deck, rank));
  return {
    ...state,
    tableViewMode,
    selectedSeatId: box1,
    blackjackFlowSettings: {
      ...state.blackjackFlowSettings,
      initialDealMode: 'instant',
      adviceEnabled: false,
    },
    blackjack: {
      ...state.blackjack!,
      status: 'player-turns',
      activeHandKey: k1,
      activePlayerId: box1,
      dealerCardIds: [findCardId(deck, '7'), findCardId(deck, 'K')],
      dealerHoleHidden: true,
      playerHands: {
        [k1]: {
          ...createBlackjackPlayerHand(box1, 0),
          cardIds,
          currentBet: 20,
          actionStatus: 'acting',
        },
      },
    },
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  if (existsSync(OUT_AFTER)) {
    writeFileSync(OUT_BEFORE, readFileSync(OUT_AFTER, 'utf8'));
  }

  const server = await createServer({
    configFile: join(__dirname, '..', 'vite.config.ts'),
    server: { port: 5198, strictPort: true },
  });
  await server.listen();

  installMobileWindow();
  const { BlackjackPanel } = await server.ssrLoadModule('/src/components/BlackjackPanel.tsx');

  async function captureHand(cardCount: 2 | 3 | 4, tableViewMode: 'card' | 'full' = 'card') {
    const panelHtml = renderToString(
      createElement(BlackjackPanel, {
        gameState: mobileViewState(cardCount, tableViewMode),
        onGameStateChange: () => undefined,
      }),
    );
    delete (globalThis as { window?: Window }).window;

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

    await page.setContent(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="http://127.0.0.1:5198/src/components/BlackjackPanel.css" />
  <link rel="stylesheet" href="http://127.0.0.1:5198/src/components/BlackjackCardView.css" />
  <link rel="stylesheet" href="http://127.0.0.1:5198/src/components/DealerBlock.css" />
  <link rel="stylesheet" href="http://127.0.0.1:5198/src/components/PlayingCard.css" />
  <link rel="stylesheet" href="http://127.0.0.1:5198/src/components/ChipStack.css" />
  <link rel="stylesheet" href="http://127.0.0.1:5198/src/index.css" />
  <style>
    html, body, #root { margin: 0; height: 844px; max-height: 844px; min-height: 844px; overflow: hidden; background: #0a1a12; }
    .bj-casino { max-width: 390px; margin: 0 auto; }
    .bj-side-rail { display: none !important; }
  </style>
</head>
<body>
  <div id="root">${panelHtml}</div>
</body>
</html>`,
      { waitUntil: 'networkidle' },
    );

    await page.waitForTimeout(500);

    const boxes = await page.evaluate(`(() => {
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
      };
      const style = (el) => {
        if (!el) return null;
        const s = getComputedStyle(el);
        return {
          height: s.height,
          minHeight: s.minHeight,
          maxHeight: s.maxHeight,
          padding: s.padding,
          display: s.display,
          gridTemplateRows: s.gridTemplateRows,
          alignSelf: s.alignSelf,
        };
      };
      const viewRoot = '.bj-view-${tableViewMode}-mobile';
      const commandZone = document.querySelector(viewRoot + ' .bj-table-zone--summary');
      const cardsZone = document.querySelector(viewRoot + ' .bj-table-zone--cards');
      const actionsZone = document.querySelector(viewRoot + ' .bj-table-zone--actions');
      const boxesZone = document.querySelector(viewRoot + ' .bj-table-zone--boxes');
      const trayZone = document.querySelector(viewRoot + ' .bj-table-zone--bottom');
      const trayInner = document.querySelector(viewRoot + ' .bj-value-chips');
      const boxesInner = document.querySelector(viewRoot + ' .bj-table-slot-row.bj-arc--player-boxes');
      const shell = document.querySelector(viewRoot + ' .bj-table-layout-shell');
      const heroPlayingCards = [...document.querySelectorAll(
        '.bj-view-card-mobile .bj-table-zone--cards.bj-cards-area--hero .playing-card.bj-phone-card--hero, .bj-view-card-mobile .bj-table-zone--cards.bj-cards-area--hero .playing-card.ds-card--hero',
      )].map((c, i) => {
        const r = c.getBoundingClientRect();
        return { i, width: r.width, height: r.height, top: r.top, bottom: r.bottom };
      });
      return {
        cardCount: ${cardCount},
        tableViewMode: '${tableViewMode}',
        commandZone: rect(commandZone),
        cardsZone: rect(cardsZone),
        actionsZone: rect(actionsZone),
        boxesZone: rect(boxesZone),
        trayZone: rect(trayZone),
        trayInner: rect(trayInner),
        boxesInner: rect(boxesInner),
        shell: rect(shell),
        trayZoneStyle: style(trayZone),
        trayInnerStyle: style(trayInner),
        boxesInnerStyle: style(boxesInner),
        shellStyle: style(shell),
        heroPlayingCards,
      };
    })()`);

    await browser.close();
    installMobileWindow();
    return boxes;
  }

  const twoCard = await captureHand(2);
  const threeCard = await captureHand(3);
  const fourCard = await captureHand(4);
  const fullTable = await captureHand(2, 'full');
  const boxes = { twoCard, threeCard, fourCard, fullTable };

  writeFileSync(OUT_AFTER, JSON.stringify(boxes, null, 2));
  await server.close();

  console.log('Mobile Card bounding boxes:', OUT_AFTER);
  if (existsSync(OUT_BEFORE)) {
    console.log('Mobile Card bounding boxes (before):', OUT_BEFORE);
  }
  console.log(JSON.stringify(boxes, null, 2));

  for (const phase of [twoCard, threeCard, fourCard] as Array<{
    cardCount: number;
    cardsZone: { top: number; bottom: number } | null;
    heroPlayingCards: Array<{ width: number; height: number; top: number; bottom: number }>;
  }>) {
    if (!phase.cardsZone || phase.heroPlayingCards.length !== phase.cardCount) {
      throw new Error(`expected ${phase.cardCount} hero cards`);
    }
    for (const card of phase.heroPlayingCards) {
      if (card.width < 85 || card.height < 120) {
        throw new Error(`${phase.cardCount}-card hero too small (${card.width}×${card.height})`);
      }
      if (card.top < phase.cardsZone.top + 2) {
        throw new Error(`${phase.cardCount}-card hero top clipped above cardsArea`);
      }
      if (card.bottom > phase.cardsZone.bottom - 0.5) {
        throw new Error(`${phase.cardCount}-card hero bottom clipped below cardsArea`);
      }
    }
  }

  for (const phase of [twoCard, threeCard, fourCard, fullTable] as Array<{
    tableViewMode: 'card' | 'full';
    commandZone: { top: number; bottom: number } | null;
    cardsZone: { top: number; bottom: number } | null;
    actionsZone: { top: number; bottom: number } | null;
    boxesZone: { top: number; bottom: number } | null;
    trayZone: { top: number; bottom: number } | null;
  }>) {
    const orderedZones = [
      ['command', phase.commandZone],
      ['cards', phase.cardsZone],
      ['actions', phase.actionsZone],
      ['boxes', phase.boxesZone],
      ['tray', phase.trayZone],
    ] as const;
    for (const [name, zone] of orderedZones) {
      if (!zone) {
        throw new Error(`${phase.tableViewMode}: missing ${name} zone`);
      }
    }
    for (let i = 0; i < orderedZones.length - 1; i += 1) {
      const [currentName, current] = orderedZones[i]!;
      const [nextName, next] = orderedZones[i + 1]!;
      if (current!.bottom > next!.top + 0.5) {
        throw new Error(
          `${phase.tableViewMode}: ${currentName} overlaps ${nextName} (${current!.bottom} > ${next!.top})`,
        );
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
