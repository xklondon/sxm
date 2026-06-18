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

  const layoutMeta = await page.evaluate(`(() => {
    const root = document.querySelector('.bj-view-card-desktop.bj-casino');
    return {
      layoutPhase: root?.getAttribute('data-bj-phase') ?? null,
      bjView: root?.getAttribute('data-bj-view') ?? null,
    };
  })()`);

  const boxes = await page.evaluate(`(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const felt = document.querySelector('.bj-view-card-desktop .bj-casino__felt');
    const bankInfo = document.querySelector('.bj-view-card-desktop .bj-table-info-bar--felt-row');
    const dealer = document.querySelector('.bj-view-card-desktop .bj-table-zone--dealer');
    const cardsZone = document.querySelector('.bj-view-card-desktop .bj-table-zone--cards.bj-cards-area--hero');
    const boxesZone = document.querySelector('.bj-view-card-desktop .bj-table-zone--boxes');
    const actionsZone = document.querySelector('.bj-view-card-desktop .bj-table-zone--actions');
    const actionRow = document.querySelector('.bj-view-card-desktop .bj-table-zone--actions [data-layout-band="action-row"]');
    const actionButtons = document.querySelector(
      '.bj-view-card-desktop .bj-table-zone--actions [data-layout-band="action-row"] .bj-table-actions__row, .bj-view-card-desktop .bj-table-zone--actions [data-layout-band="action-row"] .ds-btn--hit',
    );
    const command = document.querySelector('.bj-view-card-desktop .bj-table-zone--summary');
    const commandPill = document.querySelector(
      '.bj-view-card-desktop .bj-card-layout__command, .bj-view-card-desktop .dealer-block__command',
    );
    const heroCards = document.querySelector('.bj-view-card-desktop [data-layout-band="hero-cards"]');
    const slotRow = document.querySelector('.bj-view-card-desktop .bj-table-slot-row.bj-arc--player-boxes');
    const slotRects = slotRow
      ? [...slotRow.children].map((el, i) => {
          const r = el.getBoundingClientRect();
          return { i, left: r.left, right: r.right, width: r.width, center: r.left + r.width / 2 };
        })
      : [];
    const trayLabelEl = document.querySelector('.bj-view-card-desktop .bj-value-chips__row--label');
    const trayRow = document.querySelector('.bj-view-card-desktop [data-layout-band="tray-row"]');
    return {
      felt: rect(felt),
      bankInfo: rect(bankInfo),
      dealer: rect(dealer),
      cardsZone: rect(cardsZone),
      command: rect(command),
      commandPill: rect(commandPill),
      actionsZone: rect(actionsZone),
      heroCards: rect(heroCards),
      actionRow: rect(actionRow),
      actionButtons: rect(actionButtons),
      boxesZone: rect(boxesZone),
      trayRow: rect(trayRow),
      trayLabel: rect(trayLabelEl),
      slotRow: rect(slotRow),
      slots: slotRects,
    };
  })()`);

  if (!layoutMeta.layoutPhase) {
    throw new Error('Missing data-bj-phase on .bj-view-card-desktop.bj-casino');
  }
  if (layoutMeta.bjView !== 'card') {
    throw new Error(`Expected data-bj-view="card", got ${layoutMeta.bjView}`);
  }
  if (layoutMeta.layoutPhase !== 'playing') {
    throw new Error(`Expected data-bj-phase="playing" for capture state, got ${layoutMeta.layoutPhase}`);
  }

  const phoneViewInCards = await page.evaluate(
    'document.querySelector(".bj-view-card-desktop .bj-cards-area--hero .bj-phone-view") !== null',
  );
  if (phoneViewInCards) {
    throw new Error('Desktop Card View cards area must not render .bj-phone-view');
  }

  const actionRowScale = await page.evaluate(
    'document.querySelector(".bj-view-card-desktop .bj-table-zone--actions [data-layout-band=\\"action-row\\"]")?.getAttribute("data-action-row-scale") ?? null',
  );
  if (actionRowScale !== 'full-table') {
    throw new Error(`Expected action row scale full-table, got ${actionRowScale}`);
  }

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

  const {
    heroCards,
    actionRow,
    actionButtons,
    actionsZone,
    boxesZone,
    trayRow,
    trayLabel,
    felt,
    command,
    commandPill,
    bankInfo,
    dealer,
    cardsZone,
    slots,
  } = boxes as {
    heroCards: { top: number; bottom: number; left: number; right: number; height: number } | null;
    actionRow: { top: number; bottom: number; left: number; width: number } | null;
    actionButtons: { top: number; bottom: number; left: number; width: number } | null;
    actionsZone: { top: number; bottom: number } | null;
    boxesZone: { top: number; bottom: number; left: number; right: number } | null;
    trayRow: { top: number; bottom: number } | null;
    trayLabel: { top: number; bottom: number } | null;
    command: { top: number; bottom: number } | null;
    commandPill: { top: number; bottom: number } | null;
    felt: { top: number; bottom: number; width: number; left: number; right: number } | null;
    bankInfo: { top: number; bottom: number } | null;
    dealer: { top: number; bottom: number } | null;
    cardsZone: { top: number; bottom: number; left: number; right: number } | null;
    slots: Array<{ left: number; right: number; center: number }>;
  };

  if (!heroCards || !actionRow || !trayRow || !felt || !command || !commandPill || !actionsZone) {
    throw new Error('Missing layout bands in capture — is .bj-view-card-desktop present?');
  }
  if (!bankInfo || !dealer || !cardsZone || !boxesZone) {
    throw new Error('Missing shell zones in capture — bank/dealer/cards/boxes');
  }

  const boxesTop = boxesZone.top;

  if (heroCards.top < cardsZone.top - 1) {
    throw new Error(
      `heroCards escapes above cards zone (hero top ${heroCards.top.toFixed(1)}px, cards top ${cardsZone.top.toFixed(1)}px)`,
    );
  }
  if (heroCards.bottom > cardsZone.bottom + 1) {
    throw new Error(
      `heroCards escapes below cards zone (hero bottom ${heroCards.bottom.toFixed(1)}px, cards bottom ${cardsZone.bottom.toFixed(1)}px)`,
    );
  }
  if (commandPill.bottom > cardsZone.top + 6) {
    throw new Error(
      `command pill overlaps cards zone (pill bottom ${commandPill.bottom.toFixed(1)}px, cards top ${cardsZone.top.toFixed(1)}px)`,
    );
  }
  if (cardsZone.bottom > actionsZone.top + 2) {
    throw new Error(
      `cards zone overlaps actions zone (cards bottom ${cardsZone.bottom.toFixed(1)}px, actions top ${actionsZone.top.toFixed(1)}px)`,
    );
  }
  if (actionsZone.bottom > boxesTop + 2) {
    throw new Error(
      `actions zone overlaps boxes (actions bottom ${actionsZone.bottom.toFixed(1)}px, boxes top ${boxesTop.toFixed(1)}px)`,
    );
  }
  if (trayLabel && trayLabel.bottom > felt.bottom + 24) {
    throw new Error(
      `tray label bottom ${trayLabel.bottom.toFixed(1)}px > felt.bottom + 24 (${(felt.bottom + 24).toFixed(1)}px)`,
    );
  }
  if (trayRow.bottom > felt.bottom + 28) {
    throw new Error(
      `trayRow.bottom ${trayRow.bottom.toFixed(1)}px > felt.bottom + 28 (${(felt.bottom + 28).toFixed(1)}px)`,
    );
  }

  const overflowBands = [
    ['bankInfo', bankInfo],
    ['dealer', dealer],
    ['cardsZone', cardsZone],
    ['heroCards', heroCards],
    ['actionRow', actionRow],
    ['boxesZone', boxesZone],
    ['trayRow', trayRow],
  ] as const;
  for (const [label, band] of overflowBands) {
    if (!band) continue;
    if (band.left < felt.left - 1 || band.right > felt.right + 1) {
      throw new Error(
        `${label} horizontal overflow beyond felt (left ${band.left.toFixed(1)} right ${band.right.toFixed(1)} vs felt ${felt.left.toFixed(1)}–${felt.right.toFixed(1)})`,
      );
    }
  }

  const feltCenter = felt.left + felt.width / 2;
  const actionTarget = actionButtons ?? actionRow;
  const actionCenter = actionTarget.left + actionTarget.width / 2;
  if (Math.abs(actionCenter - feltCenter) > felt.width * 0.08) {
    throw new Error(
      `action row not horizontally centered on felt (center ${actionCenter.toFixed(1)}px vs felt ${feltCenter.toFixed(1)}px)`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
