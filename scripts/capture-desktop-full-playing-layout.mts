import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import type { GameState } from '../src/types';
import {
  fullTableDesktopAfterBankDrawState,
  fullTableDesktopBeforeBankDrawState,
  playingFullTableDesktopCardCountState,
  playingFullTableDesktopState,
} from '../src/test/fullTableDesktopLayoutState';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'reference-ui', 'captures');
const OUT_FILE = join(OUT_DIR, 'Desktop_Full_Playing_bounding_boxes.json');

type CardRect = { i: number; top: number; bottom: number; height: number; width: number };
type StackMetrics = {
  top: number;
  bottom: number;
  centerY: number;
  cardCount: number;
};

type CapturePayload = {
  scenario: string;
  dataPhase: string | null;
  dataBjPhase: string | null;
  cardsArea: { top: number; bottom: number; height: number } | null;
  cards: CardRect[];
  stacks: StackMetrics[];
  cardColumnValues: Array<{ text: string; display: string }>;
  cssTokens: {
    cardHeight: string;
    overlap3: string;
    overlap4: string;
    stackZoneHeight: string;
  };
};

async function captureScenario(
  page: import('playwright').Page,
  scenario: string,
  gameState: GameState,
  panelComponent: typeof import('../src/components/BlackjackPanel').BlackjackPanel,
): Promise<CapturePayload> {
  const panelHtml = renderToString(
    createElement(panelComponent, {
      gameState,
      onGameStateChange: () => undefined,
    }),
  );

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
  await page.waitForTimeout(400);

  return page.evaluate(`((scenario) => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const root = document.querySelector('.bj-view-full-desktop.bj-casino');
    const style = root ? getComputedStyle(root) : null;
    const cardsArea = document.querySelector('.bj-view-full-desktop .bj-table-zone--cards');
    const cards = [...document.querySelectorAll('.bj-view-full-desktop .bj-table-zone--cards .playing-card')].map((el, i) => {
      const r = el.getBoundingClientRect();
      return { i, top: r.top, bottom: r.bottom, height: r.height, width: r.width };
    });
    const stacks = [...document.querySelectorAll('.bj-view-full-desktop .bj-arc__cards-stack')].map((stack) => {
      const cardsInStack = [...stack.querySelectorAll('.playing-card')];
      const tops = cardsInStack.map((c) => c.getBoundingClientRect().top);
      const bottoms = cardsInStack.map((c) => c.getBoundingClientRect().bottom);
      const top = tops.length ? Math.min(...tops) : 0;
      const bottom = bottoms.length ? Math.max(...bottoms) : 0;
      return {
        top,
        bottom,
        centerY: (top + bottom) / 2,
        cardCount: Number(stack.getAttribute('data-bj-card-count') ?? cardsInStack.length),
      };
    });
    return {
      scenario,
      dataPhase: document.querySelector('.bj-casino')?.getAttribute('data-phase') ?? null,
      dataBjPhase: document.querySelector('.bj-casino')?.getAttribute('data-bj-phase') ?? null,
      cardsArea: rect(cardsArea),
      cards,
      stacks,
      cardColumnValues: [...document.querySelectorAll('.bj-view-full-desktop .bj-phone-view__box-value--card-column-below')].map((el) => ({
        text: el.textContent?.trim() ?? '',
        display: getComputedStyle(el).display,
      })),
      cssTokens: {
        cardHeight: style?.getPropertyValue('--bj-table-card-height')?.trim() ?? '',
        overlap3: style?.getPropertyValue('--bj-table-card-overlap-3')?.trim() ?? '',
        overlap4: style?.getPropertyValue('--bj-table-card-overlap-4plus')?.trim() ?? '',
        stackZoneHeight: style?.getPropertyValue('--bj-full-table-card-stack-zone-height')?.trim() ?? '',
      },
    };
  })('${scenario}')`) as Promise<CapturePayload>;
}

function assertContainment(capture: CapturePayload): void {
  if (capture.dataBjPhase !== 'playing') {
    throw new Error(`[${capture.scenario}] expected playing layout phase, got ${capture.dataBjPhase}`);
  }
  if (!capture.cardsArea || capture.cards.length === 0) {
    throw new Error(`[${capture.scenario}] expected visible player cards in cardsArea`);
  }
  for (const card of capture.cards) {
    if (card.top < capture.cardsArea!.top + 2) {
      throw new Error(
        `[${capture.scenario}] card top ${card.top} clipped above cardsArea ${capture.cardsArea!.top}`,
      );
    }
    if (card.bottom > capture.cardsArea!.bottom - 2) {
      throw new Error(
        `[${capture.scenario}] card bottom ${card.bottom} clipped below cardsArea ${capture.cardsArea!.bottom}`,
      );
    }
  }
  for (const value of capture.cardColumnValues) {
    if (value.display !== 'none' && value.text && value.text !== '\u00a0') {
      throw new Error(`[${capture.scenario}] card-column value should be hidden: ${value.text}`);
    }
  }
}

function assertStackStability(before: CapturePayload, after: CapturePayload): void {
  const beforeStack = before.stacks[0];
  const afterStack = after.stacks[0];
  if (!beforeStack || !afterStack) {
    throw new Error('expected stack metrics for bank-draw stability check');
  }
  const topDelta = Math.abs(afterStack.top - beforeStack.top);
  const centerDelta = Math.abs(afterStack.centerY - beforeStack.centerY);
  if (topDelta > 3) {
    throw new Error(`stack top jumped ${topDelta}px after bank draw (max 3px)`);
  }
  if (centerDelta > 3) {
    throw new Error(`stack center jumped ${centerDelta}px after bank draw (max 3px)`);
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const server = await createServer({
    configFile: join(__dirname, '..', 'vite.config.ts'),
    server: { port: 5202, strictPort: true },
  });
  await server.listen();

  const { BlackjackPanel } = await server.ssrLoadModule('/src/components/BlackjackPanel.tsx');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const scenarios: Array<{ name: string; state: GameState }> = [
    { name: 'mixed-234', state: playingFullTableDesktopState() },
    { name: 'box1-2card', state: playingFullTableDesktopCardCountState(2) },
    { name: 'box1-3card', state: playingFullTableDesktopCardCountState(3) },
    { name: 'box1-4card', state: playingFullTableDesktopCardCountState(4) },
  ];

  const captures: CapturePayload[] = [];
  for (const scenario of scenarios) {
    const capture = await captureScenario(page, scenario.name, scenario.state, BlackjackPanel);
    assertContainment(capture);
    captures.push(capture);
  }

  const beforeBank = await captureScenario(
    page,
    'before-bank-draw',
    fullTableDesktopBeforeBankDrawState(),
    BlackjackPanel,
  );
  const afterBank = await captureScenario(
    page,
    'after-bank-draw',
    fullTableDesktopAfterBankDrawState(),
    BlackjackPanel,
  );
  assertContainment(beforeBank);
  assertContainment(afterBank);
  assertStackStability(beforeBank, afterBank);
  captures.push(beforeBank, afterBank);

  const report = {
    viewport: { width: 1280, height: 800 },
    captures,
    bankDrawStability: {
      beforeTop: beforeBank.stacks[0]?.top,
      afterTop: afterBank.stacks[0]?.top,
      topDelta: Math.abs((afterBank.stacks[0]?.top ?? 0) - (beforeBank.stacks[0]?.top ?? 0)),
      beforeCenterY: beforeBank.stacks[0]?.centerY,
      afterCenterY: afterBank.stacks[0]?.centerY,
      centerDelta: Math.abs((afterBank.stacks[0]?.centerY ?? 0) - (beforeBank.stacks[0]?.centerY ?? 0)),
    },
  };

  writeFileSync(OUT_FILE, JSON.stringify(report, null, 2));
  await browser.close();
  await server.close();

  console.log('Desktop Full Playing bounding boxes:', OUT_FILE);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
