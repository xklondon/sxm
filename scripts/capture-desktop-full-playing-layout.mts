import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { playingFullTableDesktopState } from '../src/test/fullTableDesktopLayoutState';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'reference-ui', 'captures');
const OUT_FILE = join(OUT_DIR, 'Desktop_Full_Playing_bounding_boxes.json');

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const server = await createServer({
    configFile: join(__dirname, '..', 'vite.config.ts'),
    server: { port: 5202, strictPort: true },
  });
  await server.listen();

  const { BlackjackPanel } = await server.ssrLoadModule('/src/components/BlackjackPanel.tsx');
  const panelHtml = renderToString(
    createElement(BlackjackPanel, {
      gameState: playingFullTableDesktopState(),
      onGameStateChange: () => undefined,
    }),
  );

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.setContent(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="http://127.0.0.1:5202/src/index.css" />
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
  await page.waitForTimeout(500);

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
      };
    };
    const cardsArea = document.querySelector('.bj-view-full-desktop .bj-table-zone--cards');
    const cards = [...document.querySelectorAll('.bj-view-full-desktop .bj-table-zone--cards .playing-card')].map((el, i) => {
      const r = el.getBoundingClientRect();
      return { i, top: r.top, bottom: r.bottom, height: r.height, width: r.width };
    });
    return {
      dataPhase: document.querySelector('.bj-casino')?.getAttribute('data-phase') ?? null,
      dataBjPhase: document.querySelector('.bj-casino')?.getAttribute('data-bj-phase') ?? null,
      commandZone: rect(document.querySelector('.bj-view-full-desktop .bj-table-zone--summary')),
      actionRow: rect(document.querySelector('[data-layout-band="action-row"]')),
      cardsArea: rect(cardsArea),
      cards,
      cardColumnValues: [...document.querySelectorAll('.bj-view-full-desktop .bj-phone-view__box-value--card-column-below')].map((el) => ({
        text: el.textContent?.trim() ?? '',
        display: getComputedStyle(el).display,
      })),
    };
  })()`);

  writeFileSync(OUT_FILE, JSON.stringify(boxes, null, 2));
  await browser.close();
  await server.close();

  console.log('Desktop Full Playing bounding boxes:', OUT_FILE);
  console.log(JSON.stringify(boxes, null, 2));

  const capture = boxes as {
    dataBjPhase: string | null;
    cardsArea: { top: number; bottom: number } | null;
    cards: Array<{ top: number; bottom: number }>;
    cardColumnValues: Array<{ text: string; display: string }>;
  };

  if (capture.dataBjPhase !== 'playing') {
    throw new Error(`expected playing layout phase, got ${capture.dataBjPhase}`);
  }
  if (!capture.cardsArea || capture.cards.length === 0) {
    throw new Error('expected visible player cards in cardsArea');
  }
  for (const card of capture.cards) {
    if (card.top < capture.cardsArea!.top + 2) {
      throw new Error(`card top ${card.top} clipped above cardsArea ${capture.cardsArea!.top}`);
    }
    if (card.bottom > capture.cardsArea!.bottom - 2) {
      throw new Error(`card bottom ${card.bottom} clipped below cardsArea ${capture.cardsArea!.bottom}`);
    }
  }
  for (const value of capture.cardColumnValues) {
    if (value.display !== 'none' && value.text && value.text !== '\\u00a0') {
      throw new Error(`card-column value should be hidden in desktop Full Table play: ${value.text}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
