import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { playingCardDesktopState } from '../src/test/cardDesktopLayoutState';

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
  const panelHtml = renderToString(
    createElement(BlackjackPanel, {
      gameState: playingCardDesktopState(),
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

  const hasMobileCard = await page.evaluate(
    'document.querySelector(".bj-view-card-mobile") !== null',
  );
  if (!hasMobileCard) {
    throw new Error('Capture is not Mobile Card View — missing .bj-view-card-mobile');
  }

  await page.waitForTimeout(500);

  const boxes = await page.evaluate(`(() => {
    const q = (band) => document.querySelector('[data-layout-band="' + band + '"]');
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const heroValueEl = document.querySelector(
      '.bj-view-card-mobile .bj-card-view__hero-value.bj-phone-view__total--hero',
    );
    const heroValueStyle = heroValueEl ? getComputedStyle(heroValueEl) : null;
    const cardsZone = document.querySelector('.bj-view-card-mobile .bj-table-zone--cards.bj-cards-area--hero');
    const cardsZoneRect = rect(cardsZone);
    const heroPlayingCards = [...document.querySelectorAll(
      '.bj-view-card-mobile .bj-table-zone--cards.bj-cards-area--hero .playing-card.bj-phone-card--hero, .bj-view-card-mobile .bj-table-zone--cards.bj-cards-area--hero .playing-card.ds-card--hero',
    )].map((c, i) => {
      const r = c.getBoundingClientRect();
      return { i, width: r.width, height: r.height, top: r.top, bottom: r.bottom };
    });
    return {
      heroCards: rect(q('hero-cards')),
      heroValue: rect(q('hero-value')),
      heroValueText: rect(heroValueEl),
      heroValueDisplay: heroValueStyle?.display ?? null,
      heroValueVisibility: heroValueStyle?.visibility ?? null,
      actionRow: rect(q('action-row')),
      playerBoxes: rect(q('player-boxes')),
      cardsZone: cardsZoneRect,
      heroPlayingCards,
    };
  })()`);

  writeFileSync(OUT_AFTER, JSON.stringify(boxes, null, 2));

  await browser.close();
  await server.close();

  console.log('Mobile Card bounding boxes:', OUT_AFTER);
  if (existsSync(OUT_BEFORE)) {
    console.log('Mobile Card bounding boxes (before):', OUT_BEFORE);
  }
  console.log(JSON.stringify(boxes, null, 2));

  const {
    heroCards,
    heroValue,
    heroValueText,
    heroValueDisplay,
    heroValueVisibility,
    actionRow,
    playerBoxes,
    cardsZone,
    heroPlayingCards,
  } = boxes as {
    heroCards: { top: number; bottom: number; width: number; height: number } | null;
    heroValue: { top: number; bottom: number; height: number } | null;
    heroValueText: { top: number; bottom: number; height: number } | null;
    heroValueDisplay: string | null;
    heroValueVisibility: string | null;
    actionRow: { top: number } | null;
    playerBoxes: { top: number } | null;
    cardsZone: { top: number; bottom: number } | null;
    heroPlayingCards: { width: number; height: number; top: number; bottom: number }[];
  };

  if (!heroCards || !actionRow || !playerBoxes || !cardsZone) {
    throw new Error('Missing mobile Card View layout bands');
  }

  if (heroValueDisplay !== 'none' && heroValueVisibility !== 'hidden') {
    throw new Error(
      `hero value should be hidden in mobile Card View (display=${heroValueDisplay}, visibility=${heroValueVisibility})`,
    );
  }

  const heroCard = heroPlayingCards.find((c) => c.width > 0 && c.height > 0);
  if (!heroCard) {
    throw new Error('no visible hero playing cards in mobile Card View');
  }
  if (heroCard.width <= 45 || heroCard.height <= 65) {
    throw new Error(
      `hero playing card too small (${heroCard.width.toFixed(1)}×${heroCard.height.toFixed(1)}px)`,
    );
  }
  if (heroCard.top < cardsZone.top - 2 || heroCard.bottom > cardsZone.bottom + 2) {
    throw new Error('hero playing card outside cards zone');
  }

  if (heroCards.bottom > actionRow.top - 4) {
    throw new Error('hero cards overlap action row');
  }

  if (heroCards.bottom > playerBoxes.top - 4) {
    throw new Error('hero cards overlap player boxes');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
