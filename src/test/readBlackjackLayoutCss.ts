import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

/** Canonical blackjack shell/layout CSS (mirrors tableLayoutEngine + index import order subset). */
export const BLACKJACK_LAYOUT_CSS_PATHS = {
  shared: 'src/styles/bj-table-shared.css',
  shell: 'src/styles/bj-blackjack-table-shell.css',
  playerRow: 'src/styles/bj-player-row-layout.css',
  cardLayout: 'src/styles/bj-card-layout.css',
  fullTableCardArea: 'src/styles/bj-full-table-card-area.css',
  cardDesktop: 'src/styles/bj-card-desktop-layout.css',
  cardDesktopHero: 'src/styles/bj-card-desktop-hero-area.css',
  cardMobilePortrait: 'src/styles/bj-card-mobile-portrait-layout.css',
} as const;

export type BlackjackLayoutCss = {
  shared: string;
  shell: string;
  playerRow: string;
  cardLayout: string;
  fullTableCardArea: string;
  cardDesktop: string;
  cardDesktopHero: string;
  cardMobilePortrait: string;
  /** Tokens/visuals + shell geometry — use when guards previously scanned only shared.css. */
  shellContract: string;
  /** All canonical layout files concatenated (with source markers). */
  allLayout: string;
};

function readRelative(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

let cached: BlackjackLayoutCss | null = null;

export function readBlackjackLayoutCss(): BlackjackLayoutCss {
  if (cached) {
    return cached;
  }

  const shared = readRelative(BLACKJACK_LAYOUT_CSS_PATHS.shared);
  const shell = readRelative(BLACKJACK_LAYOUT_CSS_PATHS.shell);
  const playerRow = readRelative(BLACKJACK_LAYOUT_CSS_PATHS.playerRow);
  const cardLayout = readRelative(BLACKJACK_LAYOUT_CSS_PATHS.cardLayout);
  const fullTableCardArea = readRelative(BLACKJACK_LAYOUT_CSS_PATHS.fullTableCardArea);
  const cardDesktop = readRelative(BLACKJACK_LAYOUT_CSS_PATHS.cardDesktop);
  const cardDesktopHero = readRelative(BLACKJACK_LAYOUT_CSS_PATHS.cardDesktopHero);
  const cardMobilePortrait = readRelative(BLACKJACK_LAYOUT_CSS_PATHS.cardMobilePortrait);

  const parts: Array<{ path: string; content: string }> = [
    { path: BLACKJACK_LAYOUT_CSS_PATHS.shared, content: shared },
    { path: BLACKJACK_LAYOUT_CSS_PATHS.shell, content: shell },
    { path: BLACKJACK_LAYOUT_CSS_PATHS.playerRow, content: playerRow },
    { path: BLACKJACK_LAYOUT_CSS_PATHS.cardLayout, content: cardLayout },
    { path: BLACKJACK_LAYOUT_CSS_PATHS.fullTableCardArea, content: fullTableCardArea },
    { path: BLACKJACK_LAYOUT_CSS_PATHS.cardDesktop, content: cardDesktop },
    { path: BLACKJACK_LAYOUT_CSS_PATHS.cardDesktopHero, content: cardDesktopHero },
    { path: BLACKJACK_LAYOUT_CSS_PATHS.cardMobilePortrait, content: cardMobilePortrait },
  ];

  cached = {
    shared,
    shell,
    playerRow,
    cardLayout,
    fullTableCardArea,
    cardDesktop,
    cardDesktopHero,
    cardMobilePortrait,
    shellContract: `${shared}\n\n${shell}`,
    allLayout: parts
      .map(({ path, content }) => `/* ${path} */\n${content}`)
      .join('\n\n'),
  };

  return cached;
}

/** Desktop shell grid owner — replaces legacy slices from bj-table-shared.css comments. */
export function readDesktopShellGridCss(layout: BlackjackLayoutCss = readBlackjackLayoutCss()): string {
  return layout.shell;
}

/** Zone block in shared.css with `.bj-table-layout-shell ${zone}` at rule start (mobile/base bands). */
export function sharedShellZoneBlock(
  zoneClass: string,
  layout: BlackjackLayoutCss = readBlackjackLayoutCss(),
): string {
  const escaped = zoneClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    layout.shared.match(
      new RegExp(`^\\.bj-table-layout-shell ${escaped}\\s*\\{[\\s\\S]*?\\}`, 'm'),
    )?.[0] ?? ''
  );
}

/** Direct child zone rule under `.bj-view-full-desktop .bj-table-layout-shell > …` in shell.css. */
export function shellDesktopDirectZoneBlock(
  directChildSelector: string,
  layout: BlackjackLayoutCss = readBlackjackLayoutCss(),
): string {
  const escaped = directChildSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = layout.shell.matchAll(
    new RegExp(
      `\\.bj-view-full-desktop \\.bj-table-layout-shell > ${escaped}[\\s\\S]*?\\{[\\s\\S]*?\\}`,
      'gm',
    ),
  );
  for (const match of matches) {
    if (match[0].includes('height:') || match[0].includes('grid-row:')) {
      return match[0];
    }
  }
  return (
    layout.shell.match(
      new RegExp(
        `\\.bj-view-full-desktop \\.bj-table-layout-shell > ${escaped}[\\s\\S]*?\\{[\\s\\S]*?\\}`,
        'm',
      ),
    )?.[0] ?? ''
  );
}
