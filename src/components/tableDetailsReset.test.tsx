import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TableDetailsPanelContent } from './TableDetailsPanel';

const baseProps = {
  playingFor: '$5',
  minimumBet: 5,
  canChangeMinBet: false,
  onChangeMinBet: () => {},
  deckCount: 6,
  totalCards: 312,
  remaining: 300,
  hasDeck: true,
  dealSpeedLabel: 'Normal',
  canChangeDealSpeed: false,
  onCycleDealSpeed: () => {},
  protocolLabel: 'Las Vegas',
  canChangeProtocol: false,
  onChangeProtocol: () => {},
  gameEnded: false,
};

describe('TableDetailsPanelContent reset control', () => {
  it('shows Reset table for owner when enabled', () => {
    const html = renderToStaticMarkup(
      <TableDetailsPanelContent
        {...baseProps}
        canResetTable
        onResetTable={() => {}}
      />,
    );
    expect(html).toContain('Reset table');
    expect(html).toContain('Start a new game with these players');
  });

  it('hides Reset table when not owner-capable', () => {
    const html = renderToStaticMarkup(<TableDetailsPanelContent {...baseProps} />);
    expect(html).not.toContain('Reset table');
  });
});
