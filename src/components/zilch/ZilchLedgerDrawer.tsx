import { useState } from 'react';
import type { GameState } from '../../types';
import { LedgerPanel } from '../LedgerPanel';

interface ZilchLedgerDrawerProps {
  gameState: GameState;
}

export function ZilchLedgerDrawer({ gameState }: ZilchLedgerDrawerProps) {
  const [open, setOpen] = useState(false);
  const wager = gameState.tableMeta.agreement?.stakeDescription?.trim();

  return (
    <div className="zilch-panel__ledger-drawer">
      <div className="zilch-panel__ledger-bar">
        {gameState.tableMeta.owner?.ownerName && (
          <span className="zilch-panel__ledger-meta">
            Host: {gameState.tableMeta.owner.ownerName}
          </span>
        )}
        {wager && (
          <span className="zilch-panel__ledger-meta">
            Playing for: {wager}
          </span>
        )}
        <button
          type="button"
          className="secondary zilch-panel__ledger-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          Table ledger
        </button>
      </div>
      {open && (
        <div className="zilch-panel__ledger zilch-panel__ledger--open">
          <LedgerPanel gameState={gameState} />
        </div>
      )}
    </div>
  );
}
