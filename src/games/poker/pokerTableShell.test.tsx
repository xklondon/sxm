import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyHoldemTableStakeSetup, createNewHoldemTable } from '../../engine/session';
import { mapPokerTableViewModel } from './state/mapPokerTableViewModel';
import { PokerTableShell } from './components/PokerTableShell';

describe('PokerTableShell', () => {
  it('renders table markup with seats, community board, and actions — no permanent chat rail', () => {
    const state = applyHoldemTableStakeSetup(createNewHoldemTable(), {
      stakeDescription: 'Practice',
      seatChips: 500,
      bankChips: 500,
      bankerMode: 'self',
      bankerName: 'Alex',
      controllerName: 'Alex',
      controllerEmail: 'alex@example.com',
      protocolId: 'texas-holdem',
      naturalDealing: false,
      dealSpeedPreset: 'normal',
      cardTimerPreset: 0,
      bankDrawAuto: true,
      tableMode: 'practice',
      smallBlind: 5,
      bigBlind: 10,
      virtualPlayerCount: 1,
    });
    const html = renderToStaticMarkup(
      <PokerTableShell
        gameState={state}
        viewModel={mapPokerTableViewModel(state, state.session.playerIds[0]!)}
        tableId={state.session.id}
      />,
    );

    expect(html).toContain('Texas Hold');
    expect(html).toContain('data-testid="poker-header-pot"');
    expect(html).not.toContain('poker-hr-pot');
    expect(html).not.toContain('data-testid="poker-chat-dock"');
    expect(html).toContain('This Table');
  });
});
