import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createNewHoldemTable } from '../../engine/session';
import { mapPokerTableViewModel } from './state/mapPokerTableViewModel';
import { PokerTableShell } from './components/PokerTableShell';

describe('PokerTableShell', () => {
  it('renders table markup with seats, community board, and actions', () => {
    const state = createNewHoldemTable();
    const html = renderToStaticMarkup(
      <PokerTableShell viewModel={mapPokerTableViewModel(state)} tableId={state.session.id} />,
    );

    expect(html).toContain('Texas Hold');
    expect(html).toContain('poker-community');
    expect(html).toContain('poker-pot');
    expect(html).toContain('data-testid="poker-chat-dock"');
  });
});
