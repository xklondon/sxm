import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { playingCardDesktopState } from '../src/test/cardDesktopLayoutState';
import { tableAfterStartPlaying, boxPlayerId } from '../src/engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../src/engine/session';
import { addChipToBoxStake } from '../src/engine/blackjack';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'reference-ui', 'captures');
const OUT_BEFORE = join(OUT_DIR, 'Mobile_Full_bounding_boxes_before.json');
const OUT_AFTER = join(OUT_DIR, 'Mobile_Full_bounding_boxes.json');

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

function bettingFullTableState() {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  const ownerPersonId = state.tableMeta.ownerPersonId!;
  const box1 = boxPlayerId(state, 1)!;
  state = addChipToBoxStake(state, box1, 50, ownerPersonId);
  return { ...state, tableViewMode: 'full' as const };
}

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

  installMobileWindow();
  const { BlackjackPanel } = await server.ssrLoadModule('/src/components/BlackjackPanel.tsx');

  const playingState = { ...playingCardDesktopState(), tableViewMode: 'full' as const };
  const bettingState = bettingFullTableState();

  const playingHtml = renderToString(
    createElement(BlackjackPanel, {
      gameState: playingState,
      onGameStateChange: () => undefined,
    }),
  );
  const bettingHtml = renderToString(
    createElement(BlackjackPanel, {
      gameState: bettingState,
      onGameStateChange: () => undefined,
    }),
  );
  delete (globalThis as { window?: Window }).window;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  async function capturePhase(label: 'betting' | 'playing', html: string) {
    await page.setContent(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="http://127.0.0.1:5199/src/index.css" />
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
          opacity: style.opacity,
          overflow: style.overflow,
        };
      };
      const commandEl = document.querySelector(
        '.bj-view-full-mobile .bj-table-zone--summary .bj-card-layout__command',
      );
      const commandPill = document.querySelector(
        '.bj-view-full-mobile .bj-table-zone--summary .dealer-block__command',
      );
      const hitBtn = document.querySelector(
        '.bj-view-full-mobile .bj-table-zone--actions .ds-btn--hit',
      );
      const standBtn = document.querySelector(
        '.bj-view-full-mobile .bj-table-zone--actions .ds-btn--stand',
      );
      return {
        phase: '${label}',
        hasMobileFull: document.querySelector('.bj-view-full-mobile') !== null,
        commandZone: rect(document.querySelector('.bj-view-full-mobile .bj-table-zone--summary')),
        commandBox: rect(commandEl),
        commandPill: rect(commandPill),
        commandText: commandPill?.textContent?.trim() ?? null,
        hitButton: rect(hitBtn),
        standButton: rect(standBtn),
        actionRow: rect(document.querySelector('[data-layout-band="action-row"]')),
        playerBoxes: rect(document.querySelector('[data-layout-band="player-boxes"]')),
        cardColumnValues: [...document.querySelectorAll(
          '.bj-view-full-mobile .bj-phone-view__box-value--card-column-below:not(.bj-phone-view__box-value--placeholder)',
        )].map((el) => ({
          text: el.textContent?.trim() ?? '',
          display: getComputedStyle(el).display,
          visibility: getComputedStyle(el).visibility,
        })),
        boxValues: [...document.querySelectorAll(
          '.bj-view-full-mobile .bj-table-slot-row.bj-arc--player-boxes .bj-phone-view__box-value--above',
        )].map((el) => el.textContent?.trim() ?? ''),
      };
    })()`);
  }

  const betting = await capturePhase('betting', bettingHtml);
  const playing = await capturePhase('playing', playingHtml);

  const boxes = { betting, playing };
  writeFileSync(OUT_AFTER, JSON.stringify(boxes, null, 2));

  await browser.close();
  await server.close();

  console.log('Mobile Full Table bounding boxes:', OUT_AFTER);
  if (existsSync(OUT_BEFORE)) {
    console.log('Mobile Full Table bounding boxes (before):', OUT_BEFORE);
  }
  console.log(JSON.stringify(boxes, null, 2));

  for (const phase of [betting, playing] as Array<{
    hasMobileFull: boolean;
    commandBox: { height: number; display: string; visibility: string } | null;
    commandPill: { height: number; display: string; visibility: string } | null;
    commandText: string | null;
    hitButton: { height: number } | null;
  }>) {
    if (!phase.hasMobileFull) {
      throw new Error(`Missing .bj-view-full-mobile for ${phase}`);
    }
    if (!phase.commandBox || phase.commandBox.height < 8) {
      throw new Error(`command box not visible in ${phase} (height=${phase.commandBox?.height ?? 0})`);
    }
    if (!phase.commandPill || phase.commandPill.height < 8) {
      throw new Error(`command pill not visible in ${phase} (height=${phase.commandPill?.height ?? 0})`);
    }
    if (phase.commandBox.display === 'none' || phase.commandBox.visibility === 'hidden') {
      throw new Error(`command box hidden in ${phase}`);
    }
    if (!phase.commandText) {
      throw new Error(`command text empty in ${phase}`);
    }
    if (phase.hitButton && phase.hitButton.height < 40) {
      throw new Error(`Hit button too small in ${phase} (${phase.hitButton.height.toFixed(1)}px)`);
    }
    if (phase.phase === 'playing') {
      const playingPhase = phase as {
        cardColumnValues: Array<{ text: string; display: string; visibility: string }>;
        boxValues: string[];
      };
      for (const value of playingPhase.cardColumnValues) {
        if (value.display !== 'none' && value.visibility !== 'hidden' && /\d/.test(value.text)) {
          throw new Error(`card-column value visible under stacks: ${value.text}`);
        }
      }
      if (!playingPhase.boxValues.some((text) => /\d/.test(text))) {
        throw new Error('expected numeric values in mobile Full Table player boxes');
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
