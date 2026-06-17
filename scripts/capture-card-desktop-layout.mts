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
const OUT_SHOT = join(OUT_DIR, 'Desktop_Card_actual.png');
const OUT_BEFORE = join(OUT_DIR, 'Desktop_Card_bounding_boxes_before.json');
const OUT_AFTER = join(OUT_DIR, 'Desktop_Card_bounding_boxes.json');
const OUT_FULL = join(OUT_DIR, 'Desktop_Full_bounding_boxes.json');

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  if (existsSync(OUT_AFTER)) {
    writeFileSync(OUT_BEFORE, readFileSync(OUT_AFTER, 'utf8'));
  }

  const server = await createServer({
    configFile: join(__dirname, '..', 'vite.config.ts'),
    server: { port: 5199, strictPort: true },
  });
  await server.listen();

  const { BlackjackPanel } = await server.ssrLoadModule('/src/components/BlackjackPanel.tsx');
  const panelHtml = renderToString(
    createElement(BlackjackPanel, {
      gameState: playingCardDesktopState(),
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
  <link rel="stylesheet" href="http://127.0.0.1:5199/src/index.css" />
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

  const hasCardDesktop = await page.evaluate(
    'document.querySelector(".bj-view-card-desktop") !== null',
  );
  if (!hasCardDesktop) {
    throw new Error('Capture is not Desktop Card View — missing .bj-view-card-desktop');
  }

  await page.waitForTimeout(800);

  const boxes = await page.evaluate(`(() => {
    const q = (band) => document.querySelector('[data-layout-band="' + band + '"]');
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const felt = document.querySelector('.bj-view-card-desktop .bj-casino__felt');
    const actionButtons = document.querySelector(
      '.bj-view-card-desktop [data-layout-band="action-row"] .bj-table-actions__row, .bj-view-card-desktop [data-layout-band="action-row"] .bj-phone-view__action-bar-row--primary',
    );
    const command = document.querySelector('.bj-view-card-desktop .bj-table-zone--summary');
    const slotRow = document.querySelector('.bj-view-card-desktop .bj-table-slot-row.bj-arc--player-boxes');
    const slotRects = slotRow
      ? [...slotRow.children].map((el, i) => {
          const r = el.getBoundingClientRect();
          return { i, left: r.left, right: r.right, width: r.width, center: r.left + r.width / 2 };
        })
      : [];
    return {
      felt: rect(felt),
      command: rect(command),
      heroCards: rect(q('hero-cards')),
      heroValue: rect(q('hero-value')),
      actionRow: rect(q('action-row')),
      actionButtons: rect(actionButtons),
      playerBoxes: rect(q('player-boxes')),
      trayRow: rect(q('tray-row')),
      slotRow: rect(slotRow),
      slots: slotRects,
    };
  })()`);

  writeFileSync(OUT_AFTER, JSON.stringify(boxes, null, 2));
  await page.screenshot({ path: OUT_SHOT, fullPage: false });

  await browser.close();
  await server.close();

  console.log('Screenshot:', OUT_SHOT);
  console.log('Bounding boxes (after):', OUT_AFTER);
  if (existsSync(OUT_BEFORE)) {
    console.log('Bounding boxes (before):', OUT_BEFORE);
  }
  console.log(JSON.stringify(boxes, null, 2));

  const { heroCards, heroValue, actionRow, actionButtons, playerBoxes, trayRow, felt, command, slots } =
    boxes as {
      heroCards: { top: number; bottom: number; left: number; right: number } | null;
      heroValue: { top: number; bottom: number; left: number; right: number } | null;
      actionRow: { top: number; bottom: number; left: number; width: number } | null;
      actionButtons: { top: number; bottom: number; left: number; width: number } | null;
      playerBoxes: { top: number; bottom: number; width: number; left: number; right: number } | null;
      trayRow: { top: number } | null;
      command: { top: number } | null;
      felt: { width: number; left: number; right: number } | null;
      slots: Array<{ left: number; right: number; center: number }>;
    };

  if (!heroCards || !heroValue || !actionRow || !playerBoxes || !trayRow || !felt || !command) {
    throw new Error('Missing layout bands in capture — is .bj-view-card-desktop present?');
  }
  if (!(heroValue.top >= heroCards.bottom - 2)) throw new Error('hero value must be below hero cards');
  if (!(actionRow.top >= heroValue.bottom - 4)) throw new Error('actions below value');
  if (!(playerBoxes.top >= actionRow.bottom - 2)) throw new Error('boxes below actions');
  if (!(trayRow.top >= playerBoxes.bottom - 2)) throw new Error('tray below boxes');
  if (playerBoxes.width < felt.width * 0.75) throw new Error('player boxes row too narrow');

  const feltCenter = felt.left + felt.width / 2;
  const actionTarget = actionButtons ?? actionRow;
  const actionCenter = actionTarget.left + actionTarget.width / 2;
  if (Math.abs(actionCenter - feltCenter) > felt.width * 0.08) {
    throw new Error('action row not horizontally centered on felt');
  }

  for (const band of [heroCards, heroValue, actionRow, playerBoxes]) {
    if (band.bottom > playerBoxes.top + 2 && band !== playerBoxes && band.top < playerBoxes.top) {
      const overlaps = !(band.right < playerBoxes.left + 8 || band.left > playerBoxes.right - 8);
      if (overlaps && band.top < actionRow.top) {
        // hero/value may span full width — only fail if vertical overlap
      }
    }
  }
  if (heroCards.bottom > heroValue.top + 2 && heroValue.top < heroCards.bottom - 2) {
    throw new Error('hero cards overlap hero value');
  }
  if (heroValue.bottom > actionRow.top + 4) {
    throw new Error('hero value overlaps action row');
  }
  if (actionRow.bottom > playerBoxes.top + 2) {
    throw new Error('action row overlaps player boxes');
  }

  const actionToBoxesGap = playerBoxes.top - actionButtons.bottom;
  if (actionToBoxesGap < 8 || actionToBoxesGap > 14) {
    throw new Error(`action-to-boxes gap ${actionToBoxesGap.toFixed(1)}px outside 8–14px target`);
  }

  if (existsSync(OUT_FULL)) {
    const full = JSON.parse(readFileSync(OUT_FULL, 'utf8')) as {
      cardStacks?: { top: number } | null;
      actionRow?: { top: number } | null;
      playerBoxes?: { top: number } | null;
      trayRow?: { top: number } | null;
    };
    const parityChecks: Array<[string, number, number | undefined]> = [
      ['player boxes', playerBoxes.top, full.playerBoxes?.top],
      ['tray', trayRow.top, full.trayRow?.top],
      ['hero cards', heroCards.top, full.cardStacks?.top],
      ['action row', actionRow.top, full.actionRow?.top],
    ];
    for (const [label, cardTop, fullTop] of parityChecks) {
      if (fullTop == null) continue;
      const delta = Math.abs(cardTop - fullTop);
      if (delta > 5) {
        throw new Error(
          `Desktop Card View ${label} top ${cardTop.toFixed(1)}px differs from Full Table ${fullTop.toFixed(1)}px by ${delta.toFixed(1)}px`,
        );
      }
    }
    if (full.command?.top != null) {
      const commandDelta = Math.abs(command.top - full.command.top);
      if (commandDelta > 5) {
        throw new Error(
          `Desktop Card View command top ${command.top.toFixed(1)}px differs from Full Table ${full.command.top.toFixed(1)}px by ${commandDelta.toFixed(1)}px`,
        );
      }
    }
  }

  if (slots.length >= 4) {
    const first = slots[0]!.left;
    const last = slots[slots.length - 1]!.right;
    const span = last - first;
    if (span < felt.width * 0.65) {
      throw new Error('player box slots clustered — span too narrow');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
