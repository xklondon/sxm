import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { NewTableOverlay } from './NewTableOverlay';
import { TableStakePanel } from './TableStakePanel';
import { createNewBlackjackTable } from '../engine/session';

const OVERLAY_CSS = readFileSync(join(process.cwd(), 'src/components/NewTableOverlay.css'), 'utf8');
const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/TableStakePanel.tsx'), 'utf8');
const PANEL_CSS = readFileSync(join(process.cwd(), 'src/components/TableStakePanel.css'), 'utf8');
const LOBBY_SRC = readFileSync(join(process.cwd(), 'src/screens/EntryLobbyScreen.tsx'), 'utf8');
const TABLE_SRC = readFileSync(join(process.cwd(), 'src/screens/TableScreen.tsx'), 'utf8');
const SPEC = readFileSync(join(process.cwd(), 'docs/SXM_MASTER_SPEC.md'), 'utf8');
const CHANGELOG = readFileSync(join(process.cwd(), 'docs/CHANGE_LOG.md'), 'utf8');

describe('NewTableOverlay shared shell', () => {
  it('uses fixed overlay layer over the page', () => {
    expect(OVERLAY_CSS).toMatch(/\.new-table-overlay[\s\S]*position:\s*fixed/);
    expect(OVERLAY_CSS).toMatch(/\.new-table-overlay[\s\S]*inset:\s*0/);
    expect(OVERLAY_CSS).toMatch(/\.new-table-overlay[\s\S]*z-index:\s*50/);
  });

  it('renders dialog markup with overlay class', () => {
    const html = renderToStaticMarkup(
      <NewTableOverlay open title="New Table" ariaLabel="New table setup" onClose={() => {}}>
        <p>Setup body</p>
      </NewTableOverlay>,
    );
    expect(html).toContain('new-table-overlay');
    expect(html).toContain('new-table-overlay__panel');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('New Table');
  });

  it('returns null when closed', () => {
    const html = renderToStaticMarkup(
      <NewTableOverlay open={false} title="New Table" ariaLabel="New table setup" onClose={() => {}}>
        <p>Setup body</p>
      </NewTableOverlay>,
    );
    expect(html).toBe('');
  });
});

describe('New Table entry points share overlay path', () => {
  it('login lobby Open New Table uses NewTableOverlay + embedded TableStakePanel', () => {
    expect(LOBBY_SRC).toContain('NewTableOverlay');
    expect(LOBBY_SRC).toMatch(/<NewTableOverlay[\s\S]*open=\{slideOut === 'new'\}/);
    expect(LOBBY_SRC).toContain('embeddedInOverlay');
    expect(LOBBY_SRC).not.toMatch(/<EntryLobbySlideOut\s+open=\{slideOut === 'new'\}/);
    expect(LOBBY_SRC).toMatch(/<EntryLobbySlideOut\s+open=\{slideOut === 'join'\}/);
  });

  it('in-table Start New Table uses the same NewTableOverlay shell', () => {
    expect(TABLE_SRC).toContain('NewTableOverlay');
    expect(TABLE_SRC).toContain('embeddedInOverlay');
    expect(TABLE_SRC).toMatch(/stakeSetupOpen[\s\S]*NewTableOverlay/);
  });

  it('table stake panel is not rendered inside table-felt (no page reflow)', () => {
    const feltBlock = TABLE_SRC.match(
      /<section className="table-felt[\s\S]*?<\/section>/,
    )?.[0] ?? '';
    expect(feltBlock).not.toContain('TableStakePanel');
    expect(TABLE_SRC).toMatch(/\{stakeSetupOpen[\s\S]*NewTableOverlay[\s\S]*TableStakePanel/);
  });
});

describe('New Table staged UI cleanup', () => {
  it('removes numbered step indicator markup', () => {
    expect(PANEL_SRC).not.toContain('table-stake-panel__steps');
    expect(PANEL_SRC).not.toContain('renderStageIndicator');
  });

  it('uses clean stage titles without step numbers', () => {
    const html = renderToStaticMarkup(
      <TableStakePanel gameState={createNewBlackjackTable()} mode="new" embeddedInOverlay onConfirm={() => {}} />,
    );
    expect(html).toContain('<legend>Game</legend>');
    expect(html).not.toContain('1. Game');
    expect(html).not.toContain('2. Mode');
    expect(html).not.toContain('table-stake-panel__steps');
  });

  it('applies compact yellow selection button classes', () => {
    expect(PANEL_CSS).toContain('.table-stake-panel__select-btn');
    expect(PANEL_CSS).toMatch(/\.table-stake-panel--compact \.table-stake-panel__select-btn[\s\S]*min-height:\s*2\.5rem/);
    expect(PANEL_CSS).toMatch(/@media \(max-width: 720px\)[\s\S]*min-height:\s*2\.75rem/);

    const html = renderToStaticMarkup(
      <TableStakePanel gameState={createNewBlackjackTable()} mode="new" embeddedInOverlay onConfirm={() => {}} />,
    );
    expect(html).toContain('table-stake-panel__select-btn');
    expect(html).toContain('>Cards<');
    expect(html).toContain('>Continue<');
    expect(html).toContain('table-stake-panel--compact');
    expect(html).toContain('table-stake-panel--embedded');
  });

  it('separates primary nav actions from option rows', () => {
    expect(PANEL_CSS).toMatch(
      /\.table-stake-panel--compact \.table-stake-panel__nav[\s\S]*border-top:/,
    );
  });
});

describe('New Table docs discipline', () => {
  it('documents shared overlay engine and compact selection buttons', () => {
    expect(SPEC).toContain('NewTableOverlay');
    expect(SPEC).toMatch(/overlay.*never pushes|does not push|fixed overlay/i);
    expect(SPEC).toContain('table-stake-panel__select-btn');
    expect(CHANGELOG).toMatch(/New Table|NewTableOverlay/i);
  });
});
