import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MOBILE_LAYOUT_MEDIA } from '../src/styles/mobileLayoutContract';
import { playingCardDesktopState } from '../src/test/cardDesktopLayoutState';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'reference-ui', 'captures');
const OUT_BEFORE = join(OUT_DIR, 'Mobile_Full_Landscape_bounding_boxes_before.json');
const OUT_AFTER = join(OUT_DIR, 'Mobile_Full_Landscape_bounding_boxes.json');

function installLandscapeWindow() {
  (globalThis as { window?: Window }).window = {
    innerWidth: 844,
    innerHeight: 390,
    matchMedia: (query: string) => {
      let matches = false;
      if (query === MOBILE_LAYOUT_MEDIA || (query.includes('960px') && query.includes('pointer: coarse'))) {
        matches = 844 <= 960 && 390 <= 520;
      } else if (/max-width:\s*720/.test(query)) {
        matches = 844 <= 720;
      } else if (query.includes('orientation: landscape')) {
        matches = true;
      } else if (query.includes('orientation: portrait')) {
        matches = false;
      }
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
    server: { port: 5195, strictPort: true },
  });
  await server.listen();

  const state = { ...playingCardDesktopState(), tableViewMode: 'full' as const };
  installLandscapeWindow();
  const { BlackjackPanel } = await server.ssrLoadModule('/src/components/BlackjackPanel.tsx');
  const panelHtml = renderToString(
    createElement(BlackjackPanel, {
      gameState: state,
      onGameStateChange: () => undefined,
    }),
  );
  delete (globalThis as { window?: Window }).window;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await page.setContent(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="http://127.0.0.1:5195/src/index.css" />
  <style>
    html, body, #root { margin: 0; height: 390px; max-height: 390px; overflow: hidden; background: #0a1a12; }
    .bj-side-rail, .bj-casino__table-header, .online-bar, .magic8-table-zone { display: none !important; }
    .bj-casino, .bj-mobile-table-shell, .bj-casino__rail-wrap, .bj-casino__felt { height: 100%; max-height: 100%; min-height: 0; }
  </style>
</head>
<body>
  <div id="root">${panelHtml}</div>
</body>
</html>`,
    { waitUntil: 'networkidle' },
  );

  const hasMobileFull = await page.evaluate(
    'document.querySelector(".bj-view-full-mobile") !== null',
  );
  if (!hasMobileFull) {
    throw new Error('Capture is not Mobile Full Table — missing .bj-view-full-mobile');
  }

  await page.waitForTimeout(500);

  const boxes = await page.evaluate(`(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const shell = document.querySelector('.bj-table-layout-shell');
    const shellRect = shell ? shell.getBoundingClientRect() : null;
    const cards = [...document.querySelectorAll('.bj-arc--cards .playing-card, .bj-table-zone--cards .playing-card')];
    const cardRects = cards.map((c, i) => {
      const r = c.getBoundingClientRect();
      return { i, width: r.width, height: r.height, top: r.top, bottom: r.bottom };
    });
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    shell: rect('.bj-table-layout-shell'),
    dealer: rect('.bj-table-layout-shell > .bj-dealer-area'),
    command: rect('.bj-table-layout-shell > .bj-table-zone--summary'),
    cardsZone: rect('.bj-table-layout-shell > .bj-table-zone--cards'),
    actions: rect('.bj-table-layout-shell > .bj-table-zone--actions'),
    playerBoxes: rect('.bj-table-layout-shell > .bj-table-zone--boxes'),
    tray: rect('.bj-table-layout-shell > .bj-table-zone--bottom'),
    playingCards: cardRects,
    shellHeight: shellRect ? shellRect.height : null,
  };
  })()`);

  writeFileSync(OUT_AFTER, JSON.stringify(boxes, null, 2));
  await browser.close();
  await server.close();

  console.log('Mobile Full landscape bounding boxes:', OUT_AFTER);
  if (existsSync(OUT_BEFORE)) {
    console.log('Mobile Full landscape bounding boxes (before):', OUT_BEFORE);
  }
  console.log(JSON.stringify(boxes, null, 2));

  type Zone = { top: number; bottom: number; left: number; right: number; width: number; height: number };
  const {
    viewport,
    shell,
    dealer,
    command,
    cardsZone,
    actions,
    playerBoxes,
    tray,
    playingCards,
    shellHeight,
  } = boxes as {
    viewport: { width: number; height: number };
    shell: Zone | null;
    dealer: Zone | null;
    command: Zone | null;
    cardsZone: Zone | null;
    actions: Zone | null;
    playerBoxes: Zone | null;
    tray: Zone | null;
    playingCards: { width: number; height: number; top: number; bottom: number }[];
    shellHeight: number | null;
  };

  if (!shell || !dealer || !command || !cardsZone || !actions || !playerBoxes || !tray) {
    throw new Error('Missing mobile Full Table landscape zones');
  }

  const inViewport = (z: Zone) =>
    z.top >= -2 && z.left >= -2 && z.bottom <= viewport.height + 2 && z.right <= viewport.width + 2;

  for (const [name, zone] of Object.entries({ dealer, command, cardsZone, actions, playerBoxes, tray })) {
    if (!inViewport(zone)) {
      throw new Error(`zone ${name} outside viewport`);
    }
  }

  if (shellHeight && shellHeight > viewport.height + 4) {
    throw new Error(`layout shell taller than viewport (${shellHeight.toFixed(1)}px)`);
  }

  const visibleCard = playingCards.find((c) => c.width > 0 && c.height > 0);
  if (!visibleCard) {
    throw new Error('no visible playing cards in mobile Full Table landscape');
  }

  if (tray.height < 24) {
    throw new Error(`tray too short (${tray.height.toFixed(1)}px)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
