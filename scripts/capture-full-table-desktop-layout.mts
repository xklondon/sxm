import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { playingFullTableDesktopState } from '../src/test/fullTableDesktopLayoutState';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'reference-ui', 'captures');
const OUT_SHOT = join(OUT_DIR, 'Desktop_Full_actual.png');
const OUT_BOXES = join(OUT_DIR, 'Desktop_Full_bounding_boxes.json');

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const server = await createServer({
    configFile: join(__dirname, '..', 'vite.config.ts'),
    server: { port: 5200, strictPort: true },
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
  <link rel="stylesheet" href="http://127.0.0.1:5200/src/index.css" />
  <style>
    html, body, #root { margin: 0; min-height: 100vh; background: #0a1a12; }
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

  const hasFullDesktop = await page.evaluate(
    'document.querySelector(".bj-view-full-desktop") !== null',
  );
  if (!hasFullDesktop) {
    throw new Error('Capture is not Desktop Full Table — missing .bj-view-full-desktop');
  }

  await page.waitForTimeout(800);

  const boxes = await page.evaluate(`(() => {
    const q = (band) => document.querySelector('[data-layout-band="' + band + '"]');
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const felt = document.querySelector('.bj-view-full-desktop .bj-casino__felt');
    const valueBands = [...document.querySelectorAll('.bj-view-full-desktop .bj-phone-view__box-value')].map((el) => rect(el));
    const command = document.querySelector('.bj-view-full-desktop .bj-table-zone--summary');
    const slotRow = document.querySelector('.bj-view-full-desktop .bj-table-slot-row.bj-arc--player-boxes');
    const slotRects = slotRow
      ? [...slotRow.children].map((el, i) => {
          const r = el.getBoundingClientRect();
          return { i, left: r.left, right: r.right, width: r.width, center: r.left + r.width / 2 };
        })
      : [];
    return {
      felt: rect(felt),
      command: rect(command),
      cardStacks: rect(document.querySelector('.bj-view-full-desktop .bj-table-slot-row.bj-arc--cards')),
      actionRow: rect(q('action-row')),
      playerBoxes: rect(q('player-boxes')),
      trayRow: rect(q('tray-row')),
      valueBands,
      slotRow: rect(slotRow),
      slots: slotRects,
    };
  })()`);

  writeFileSync(OUT_BOXES, JSON.stringify(boxes, null, 2));
  await page.screenshot({ path: OUT_SHOT, fullPage: false });

  await browser.close();
  await server.close();

  console.log('Screenshot:', OUT_SHOT);
  console.log('Bounding boxes:', OUT_BOXES);
  console.log(JSON.stringify(boxes, null, 2));

  const { cardStacks, actionRow, playerBoxes, trayRow, felt, slots, valueBands } = boxes as {
    cardStacks: { top: number; bottom: number } | null;
    actionRow: { top: number; bottom: number } | null;
    playerBoxes: { top: number; bottom: number; width: number; left: number; right: number } | null;
    trayRow: { top: number } | null;
    felt: { width: number; left: number } | null;
    slots: Array<{ left: number; right: number }>;
    valueBands: Array<{ width: number; height: number } | null>;
  };

  if (!cardStacks || !actionRow || !playerBoxes || !trayRow || !felt) {
    throw new Error('Missing layout bands in Full Table capture');
  }
  if (!(actionRow.top >= cardStacks.bottom - 4)) throw new Error('actions must be below card stacks');
  if (!(playerBoxes.top >= actionRow.bottom - 4)) throw new Error('boxes below actions');
  if (!(trayRow.top >= playerBoxes.bottom - 4)) throw new Error('tray below boxes');
  const actionToBoxes = playerBoxes.top - actionRow.bottom;
  if (actionToBoxes > 80) throw new Error('action row too far from player boxes');

  for (const band of valueBands) {
    if (!band) continue;
    if (band.width < 12) throw new Error('card value band too narrow (squashed)');
    if (band.height < 8) throw new Error('card value band too short (clipped)');
  }

  if (playerBoxes.width < felt.width * 0.75) throw new Error('player boxes row too narrow');
  if (slots.length >= 4) {
    const span = slots[slots.length - 1]!.right - slots[0]!.left;
    if (span < felt.width * 0.65) throw new Error('player box slots clustered');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
