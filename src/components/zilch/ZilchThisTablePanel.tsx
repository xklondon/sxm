import { useState } from 'react';
import type { GameState } from '../../types';
import type { VirtualPlayerStyle } from '../../types/player';
import { LedgerPanel } from '../LedgerPanel';

const VIRTUAL_STYLES: VirtualPlayerStyle[] = [
  'conservative',
  'normal',
  'aggressive',
  'random',
];

interface ZilchThisTablePanelProps {
  gameState: GameState;
  isPractice: boolean;
  virtualStyle: VirtualPlayerStyle;
  onVirtualStyleChange: (style: VirtualPlayerStyle) => void;
  onResetTable?: () => void;
  onInviteTable?: () => void;
  onAddVirtual?: () => void;
  onClose?: () => void;
}

export function ZilchThisTablePanel({
  gameState,
  isPractice,
  virtualStyle,
  onVirtualStyleChange,
  onResetTable,
  onInviteTable,
  onAddVirtual,
  onClose,
}: ZilchThisTablePanelProps) {
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const { tableMeta, zilchSettings } = gameState;
  const modeLabel = tableMeta.tableMode === 'challenge' ? 'Challenge' : 'Practice';
  const targetLabel =
    zilchSettings.mode === 'target_points'
      ? `Target ${zilchSettings.targetPoints.toLocaleString()}`
      : `${zilchSettings.roundLimit} rounds`;
  const wager = tableMeta.agreement?.stakeDescription?.trim();

  return (
    <div className="zilch-this-table" data-testid="zilch-this-table-panel">
      <div className="zilch-this-table__section">
        <h4 className="zilch-this-table__heading">Table</h4>
        {onResetTable && (
          <button type="button" className="secondary zilch-this-table__btn" onClick={onResetTable}>
            Reset table
          </button>
        )}
        {onInviteTable && (
          <button type="button" className="zilch-this-table__btn" onClick={onInviteTable}>
            Invite player
          </button>
        )}
        {isPractice && onAddVirtual && (
          <>
            <select
              className="secondary zilch-this-table__select"
              value={virtualStyle}
              onChange={(e) => onVirtualStyleChange(e.target.value as VirtualPlayerStyle)}
              aria-label="Virtual player style"
            >
              {VIRTUAL_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="button" className="secondary zilch-this-table__btn" onClick={onAddVirtual}>
              Add virtual player
            </button>
          </>
        )}
      </div>

      <div className="zilch-this-table__section">
        <h4 className="zilch-this-table__heading">Game settings</h4>
        <dl className="zilch-this-table__meta">
          <div>
            <dt>Play mode</dt>
            <dd>{modeLabel}</dd>
          </div>
          <div>
            <dt>Scoring</dt>
            <dd>{targetLabel}</dd>
          </div>
          {wager && (
            <div>
              <dt>Playing for</dt>
              <dd>{wager}</dd>
            </div>
          )}
          {tableMeta.owner?.ownerName && (
            <div>
              <dt>Host</dt>
              <dd>{tableMeta.owner.ownerName}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="zilch-this-table__section">
        <h4 className="zilch-this-table__heading">Ledger</h4>
        <button
          type="button"
          className="secondary zilch-this-table__btn"
          aria-expanded={ledgerOpen}
          onClick={() => setLedgerOpen((open) => !open)}
        >
          {ledgerOpen ? 'Hide ledger' : 'Show ledger'}
        </button>
        {ledgerOpen && (
          <div className="zilch-this-table__ledger">
            <LedgerPanel gameState={gameState} />
          </div>
        )}
      </div>

      {onClose && (
        <div className="zilch-this-table__footer">
          <button type="button" className="zilch-this-table__btn" onClick={onClose}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
