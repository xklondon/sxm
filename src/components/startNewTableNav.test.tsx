// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TableStakePanel } from './TableStakePanel';
import { createNewBlackjackTable } from '../engine/session';
import type { TableStakeSetupInput } from '../engine/session/tableSetup';

describe('Start New Table nav setup', () => {
  it('renders Start new table title for mode=new (same as post magic-link setup)', () => {
    const html = renderToStaticMarkup(
      <TableStakePanel gameState={createNewBlackjackTable()} mode="new" onConfirm={() => {}} />,
    );
    expect(html).toContain('Start new table');
    expect(html).toContain('<legend>Game category</legend>');
    expect(html).not.toContain('Reset table');
    expect(html).not.toContain('New Game');
  });

  it('confirmNewTable path calls create handler instead of mutating overlay state', async () => {
    const onConfirmNewTable = vi.fn(async (_input: TableStakeSetupInput) => {});
    const onConfirm = vi.fn();
    const html = renderToStaticMarkup(
      <TableStakePanel
        gameState={createNewBlackjackTable()}
        mode="new"
        onConfirm={onConfirm}
        onConfirmNewTable={onConfirmNewTable}
      />,
    );
    expect(html).toContain('Start new table');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onConfirmNewTable).not.toHaveBeenCalled();
  });
});
