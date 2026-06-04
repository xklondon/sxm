import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { BlackjackFlowSettingsMenu } from './BlackjackFlowSettings';
import { tableAfterStartPlaying } from '../engine/blackjack/sanity/fixtures';

const noop = () => {};

vi.mock('../storage/profileStorage', () => ({
  loadProfile: () => ({ name: 'Alice', email: 'alice@test.com' }),
}));

let simulatedWidth = 1280;
const globalRef = globalThis as unknown as { window?: unknown };
const hadWindow = 'window' in globalRef;

beforeAll(() => {
  globalRef.window = {
    matchMedia: (query: string) => {
      const m = /max-width:\s*(\d+)/.exec(query);
      const max = m ? Number(m[1]) : Number.POSITIVE_INFINITY;
      return {
        matches: simulatedWidth <= max,
        media: query,
        addEventListener: noop,
        removeEventListener: noop,
        addListener: noop,
        removeListener: noop,
        onchange: null,
        dispatchEvent: () => false,
      };
    },
  };
});

afterAll(() => {
  if (!hadWindow) {
    delete globalRef.window;
  }
});

function renderSettings(width: number, state: GameState): string {
  simulatedWidth = width;
  return renderToStaticMarkup(
    <BlackjackFlowSettingsMenu
      gameState={state}
      onGameStateChange={noop}
      open
      onClose={noop}
    />,
  );
}

describe('Table settings modal layout', () => {
  const state = tableAfterStartPlaying(500);
  const css = readFileSync(join(process.cwd(), 'src/components/BlackjackFlowSettings.css'), 'utf8');

  it('desktop: compact panel width and 2-column grid', () => {
    const html = renderSettings(1280, state);
    expect(html).toContain('invite-modal--settings-panel');
    expect(html).toContain('bj-flow-settings__grid');
    expect(html).toContain('bj-flow-settings__card');
    expect(html).toContain('bj-settings-modal__body');
    expect(html).toContain('bj-settings-modal__footer');
    expect(html).toContain('Table settings');
    expect(html).toContain('Natural dealing');
    expect(html).toContain('Auto bank play');
    expect(css).toContain('max-width: 840px');
    expect(css).toMatch(/grid-template-columns:\s*1fr\s+1fr/);
    expect(css).toContain('scrollbar-gutter: stable');
  });

  it('mobile: single-column grid in markup with compact width cap', () => {
    const html = renderSettings(390, state);
    expect(html).toContain('bj-flow-settings__grid');
    expect(css).toMatch(/grid-template-columns:\s*1fr;/);
    expect(css).toContain('@media (min-width: 640px)');
  });

  it('body scroll is isolated from modal shell', () => {
    expect(css).toContain('.bj-settings-modal__body');
    expect(css).toContain('.invite-modal--settings-panel');
    expect(css).toMatch(/\.invite-modal--settings-panel[\s\S]*overflow:\s*hidden/);
  });
});
