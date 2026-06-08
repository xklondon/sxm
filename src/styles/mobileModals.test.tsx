import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { AssignChipsModal } from '../components/AssignChipsModal';
import { ChangeMinBetModal } from '../components/ChangeMinBetModal';
import { LocalProfileSetup } from '../components/LocalProfileSetup';
import { InviteModal } from '../components/InviteModal';
import { createNewBlackjackTable } from '../engine/session';
import type { GameState } from '../types';

const noop = () => {};

function readCss(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

function bettingTable(): GameState {
  return createNewBlackjackTable();
}

describe('mobile Full Table arc fit (CSS contract)', () => {
  const css = readCss('src/components/BlackjackPanel.css');

  it('felt-main hides horizontal overflow; arc stays within shell width', () => {
    expect(css).toContain('contract: mobile-arc-fit');
    expect(css).toMatch(
      /\.bj-view-full-mobile \.bj-casino__felt-main,\s*\n\s*\.bj-view-card-mobile \.bj-casino__felt-main[\s\S]*overflow-x:\s*hidden[\s\S]*overflow-y:\s*hidden/,
    );
  });

  it('page root hides horizontal overflow; card arc uses full shell width', () => {
    expect(css).toMatch(/\.bj-view-full-mobile[\s\S]*overflow-x:\s*hidden/);
    expect(css).toMatch(/\.bj-view-full-mobile \.bj-arc--cards[\s\S]*width:\s*100%/);
    expect(css).not.toMatch(/\.bj-view-full-mobile \.bj-arc[\s\S]*min-width:\s*calc\(100% \+ 2\.5rem\)/);
  });

  it('card arc slots keep center-bottom transform origin and mobile scale', () => {
    expect(css).toMatch(
      /\.bj-view-full-mobile \.bj-arc--cards \.bj-arc__slot[\s\S]*transform-origin:\s*center bottom/,
    );
  });
});

describe('mobile modal CSS contract', () => {
  const mobileCss = readCss('src/styles/mobile-modals.css');
  const desktopCss = readCss('src/styles/design-system.css');

  it('mobile modals use dynamic max-height and scrollable bodies at ≤720px', () => {
    expect(mobileCss).toMatch(/@media \(max-width: 720px\)/);
    expect(mobileCss).toMatch(/max-height:\s*min\(90dvh,\s*calc\(100dvh - 2rem\)\)/);
    expect(mobileCss).toMatch(/overflow-y:\s*auto/);
    expect(mobileCss).toMatch(/-webkit-overflow-scrolling:\s*touch/);
    expect(mobileCss).toMatch(/env\(safe-area-inset-bottom/);
  });

  it('covers Settings, Profile, Invite, Assign, and table setup overlays', () => {
    expect(mobileCss).toContain('.bj-flow-settings');
    expect(mobileCss).toContain('.local-profile');
    expect(mobileCss).toContain('.invite-modal');
    expect(mobileCss).toContain('.banker-setup-overlay');
    expect(mobileCss).toContain('.table-stake-overlay');
  });

  it('desktop ds-modal-panel rule is unchanged (no mobile calc in design-system)', () => {
    expect(desktopCss).toMatch(/\.ds-modal-panel[\s\S]*max-height:\s*90dvh/);
    expect(desktopCss).not.toContain('calc(100dvh - 2rem)');
  });
});

describe('mobile modal markup — Save/Confirm actions remain reachable', () => {
  it('Assign chips modal includes Confirm in the actions row', () => {
    const html = renderToStaticMarkup(
      <AssignChipsModal gameState={bettingTable()} open onClose={noop} onAssign={noop} />,
    );
    expect(html).toContain('invite-modal__actions');
    expect(html).toContain('Confirm');
  });

  it('Change minimum bet modal includes Save', () => {
    const html = renderToStaticMarkup(
      <ChangeMinBetModal gameState={bettingTable()} open onClose={noop} onSave={noop} />,
    );
    expect(html).toContain('invite-modal__actions');
    expect(html).toMatch(/Save|Update/i);
  });

  it('Profile modal includes Save profile', () => {
    const html = renderToStaticMarkup(
      <LocalProfileSetup open onClose={noop} onSaved={noop} />,
    );
    expect(html).toContain('Save profile');
  });

  it('Invite modal includes Send invite action', () => {
    const html = renderToStaticMarkup(
      <InviteModal
        gameState={bettingTable()}
        open
        onClose={noop}
        onInvite={noop}
      />,
    );
    expect(html).toContain('invite-modal__actions');
    expect(html).toMatch(/Generate join link|Send invite/i);
  });
});
