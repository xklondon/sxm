import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameState } from '../types';
import { applyTableStakeSetup } from '../engine/session/tableSetup';
import { createNewBlackjackTable } from '../engine/session';
import { LeaveTableConfirmDialog } from './LeaveTableConfirmDialog';
import { BlackjackPanel } from './BlackjackPanel';
import { BlackjackFeltClothLayer } from './BlackjackFeltClothLayer';
import { ValueAndChipsBar } from './ChipStack';
import { TableInfoBar } from './TableInfoBar';
import {
  applyDefaultAssignedChipTarget,
  reconcileLocalChipTarget,
  resolveTrayTargetFromLocalSelection,
  selectLocalChipTarget,
  createEmptyLocalChipTarget,
} from './localChipTargetSelection';
import { addChipToBoxStake } from '../engine/blackjack/stakes';
import {
  tableAfterStartPlaying,
  boxPlayerId,
} from '../engine/blackjack/sanity/fixtures';
import { claimBoxSlot } from '../engine/session';
import {
  DEFAULT_PRACTICE_TABLE_NAME,
  DEFAULT_TABLE_TRAY_LABEL,
} from '../types/tableFeltSkin';
import { getBoxBorderVisualClasses, resolveBoxBorderVisualState } from './cardViewBox';

const PANEL_SRC = readFileSync(join(process.cwd(), 'src/components/BlackjackPanel.tsx'), 'utf8');
const APP_SRC = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
const SHELL_SRC = readFileSync(
  join(process.cwd(), 'src/components/BlackjackTableLayoutShell.tsx'),
  'utf8',
);

const noop = () => {};

function bettingTable(): GameState {
  let state = tableAfterStartPlaying(500);
  state = claimBoxSlot(state, 1);
  state = claimBoxSlot(state, 3);
  return {
    ...state,
    tableMeta: {
      ...state.tableMeta,
      showStakeSetup: false,
      tableFeltSkin: 'classic-casino',
      tableClothName: 'Friday Night',
      tableClothWager: 'Dinner',
      tableMode: 'challenge',
    },
  };
}

describe('Leave table confirmation', () => {
  it('shows save / leave / cancel actions in dialog markup', () => {
    const html = renderToStaticMarkup(
      <LeaveTableConfirmDialog
        open
        onSaveAndLeave={() => {}}
        onLeaveWithoutSaving={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('Save this table before leaving?');
    expect(html).toContain('Save and leave');
    expect(html).toContain('Leave without saving');
    expect(html).toContain('Cancel');
  });

  it('App wires leave confirmation without changing logout', () => {
    expect(APP_SRC).toContain('LeaveTableConfirmDialog');
    expect(APP_SRC).toContain('requestLeaveTable');
    expect(APP_SRC).toContain('handleSaveAndLeaveTable');
    expect(APP_SRC).toContain('handleLeaveTableWithoutSaving');
    expect(APP_SRC).toMatch(/handleLogout[\s\S]*Sign out/);
  });
});

describe('Bank info inside table felt', () => {
  it('renders bank row in layout shell before dealer', () => {
    expect(SHELL_SRC).toMatch(/tableBankInfo[\s\S]*\{dealer\}/);
    expect(PANEL_SRC).toContain('variant="felt"');
    expect(PANEL_SRC).not.toContain('bj-casino__header-bank');
  });

  it('renders Bank Total inside table markup for full and card views', () => {
    const state = bettingTable();
    const full = renderToStaticMarkup(
      <BlackjackPanel gameState={{ ...state, tableViewMode: 'full' }} onGameStateChange={noop} />,
    );
    const card = renderToStaticMarkup(
      <BlackjackPanel gameState={{ ...state, tableViewMode: 'card' }} onGameStateChange={noop} />,
    );
    expect(full).toContain('Bank Total:');
    expect(card).toContain('Bank Total:');
    expect(full).toContain('bj-table-info-bar--felt-row');
    expect(full).not.toContain('bj-casino__header-bank');
  });

  it('TableInfoBar felt variant uses bank summary section', () => {
    const html = renderToStaticMarkup(
      <TableInfoBar gameState={bettingTable()} viewerPersonId={null} variant="felt" />,
    );
    expect(html).toContain('sxm-balance-display');
    expect(html).toContain('Bank Total:');
  });
});

describe('Mobile chip target persistence', () => {
  it('owned boxes overlay selected border on native assignment', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    const nativeBox = boxPlayerId(state, 1)!;
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const resolved = resolveBoxBorderVisualState({
      state,
      boxPlayerId: nativeBox,
      viewerPersonId: personId,
      selectedBettingBoxId: nativeBox,
      bettingStage: true,
    });
    expect(getBoxBorderVisualClasses(resolved)).toContain('bj-box--native-assigned');
    expect(getBoxBorderVisualClasses(resolved)).toContain('bj-box--selected');
  });

  it('keeps selected box target after two optimistic chip placements', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const box3 = boxPlayerId(state, 3)!;
    let local = selectLocalChipTarget(createEmptyLocalChipTarget(), { kind: 'box', boxId: box3 });

    state = addChipToBoxStake(state, box3, 10, personId);
    local = reconcileLocalChipTarget(local, state, false);
    expect(resolveTrayTargetFromLocalSelection(local, state, false, personId)).toEqual({
      kind: 'box',
      boxId: box3,
    });

    state = addChipToBoxStake(state, box3, 5, personId);
    local = reconcileLocalChipTarget(local, state, false);
    expect(resolveTrayTargetFromLocalSelection(local, state, false, personId)).toEqual({
      kind: 'box',
      boxId: box3,
    });
  });

  it('does not fall back to assigned box after explicit selection with stake', () => {
    let state = tableAfterStartPlaying(500);
    state = claimBoxSlot(state, 1);
    state = claimBoxSlot(state, 3);
    const personId = state.tableMeta.boxSlots.find((s) => s.slotNumber === 1)?.bankrollOwnerId ?? '';
    const box3 = boxPlayerId(state, 3)!;
    const local = selectLocalChipTarget(createEmptyLocalChipTarget(), { kind: 'box', boxId: box3 });
    state = addChipToBoxStake(state, box3, 10, personId);
    const blocked = applyDefaultAssignedChipTarget(local, state, personId);
    expect(blocked).toEqual(local);
  });

  it('uses same arc box render path for owned boxes', () => {
    expect(PANEL_SRC).toContain('renderArcBoxSlot');
    expect(PANEL_SRC).toContain('getBoxCardVisualClasses(borderState)');
    expect(PANEL_SRC).toContain('resolveCurrentChipTarget');
    expect(PANEL_SRC).toContain('affirmChipTargetAfterPlacement');
  });
});

describe('Mobile tray safe-area layout', () => {
  it('renders two-row tray with label below chips', () => {
    const html = renderToStaticMarkup(
      <ValueAndChipsBar
        available={500}
        showChips
        onChipClick={noop}
        trayLabel={DEFAULT_TABLE_TRAY_LABEL}
      />,
    );
    expect(html).toContain('bj-value-chips--with-label');
    expect(html).toContain('bj-value-chips__row--main');
    expect(html).toContain('bj-value-chips__row--label');
    expect(html).toContain(DEFAULT_TABLE_TRAY_LABEL);
    expect(html.indexOf('Available: 500')).toBeLessThan(html.indexOf(DEFAULT_TABLE_TRAY_LABEL));
  });

  it('passes mobile tray label from panel renderTrayInner', () => {
    expect(PANEL_SRC).toContain('resolveTableTrayLabel');
    expect(PANEL_SRC).toContain('trayLabel={deviceView === \'mobile\' ? trayLabel : undefined}');
  });
});

describe('Table name and cloth metadata', () => {
  it('challenge setup form includes Table Name field', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/TableStakePanel.tsx'), 'utf8');
    expect(src).toContain('Table name');
    expect(src).toContain('tableName');
  });

  it('practice setup defaults table name through applyTableStakeSetup', () => {
    let state = createNewBlackjackTable();
    state = applyTableStakeSetup(state, {
      stakeDescription: 'Practice',
      tableName: DEFAULT_PRACTICE_TABLE_NAME,
      seatChips: 500,
      bankChips: 500,
      bankerMode: 'bot',
      bankerName: '',
      controllerName: 'Tester',
      controllerEmail: 'test@example.com',
      protocolId: 'las-vegas-house',
      naturalDealing: true,
      dealSpeedPreset: 'fast',
      cardTimerPreset: 0,
      bankDrawAuto: true,
      tableMode: 'practice',
    });
    expect(state.tableMeta.tableClothName).toBe(DEFAULT_PRACTICE_TABLE_NAME);
  });

  it('felt layer shows table name, wager, protocol, and custom rules placeholder', () => {
    const html = renderToStaticMarkup(
      <BlackjackFeltClothLayer
        tableName="My Table"
        wagerText="Dinner"
        protocolText="Las Vegas Protocol — house rules"
        customRulesText="House Rules: Standard"
      />,
    );
    expect(html).toContain('My Table');
    expect(html).toContain('Playing for Dinner');
    expect(html).toContain('Las Vegas Protocol — house rules');
    expect(html).toContain('House Rules: Standard');
    expect(html).toContain('bj-felt-cloth-layer__custom-rules');
  });
});
