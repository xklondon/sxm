import { useMemo, useState, type ReactNode } from 'react';
import type { GameState } from '../types';
import type { ScoreLedgerEntry } from '../types/scoreLedger';
import {
  filterPersonalLedgerEntries,
  filterScoreLedgerByPerson,
  filterScoreLedgerByTable,
  listScoreLedgerPersonOptions,
  listScoreLedgerTableOptions,
  loadScoreLedgerDisplayEntries,
} from '../storage/scoreLedgerStorage';
import { LedgerPanel } from './LedgerPanel';
import { SXM_LAYOUT, sxmSectionProps, type SxmLayoutSection } from './sxmLayoutContract';
import './InviteModal.css';

interface PlayLedgerPanelProps {
  gameState: GameState;
}

export function PlayLedgerPanel({ gameState }: PlayLedgerPanelProps) {
  return (
    <div className="bj-table-slide-panel__content">
      <h3 className="bj-table-slide-panel__title">Play Ledger</h3>
      <p className="bj-table-slide-panel__sub">
        Chip and table action history for this game — bets, wins, losses, and adjustments.
      </p>
      <LedgerPanel gameState={gameState} variant="play" />
    </div>
  );
}

interface ThisTableSlidePanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Right-side slide drawer for bank/players — keeps the felt dealer zone centred. */
export function ThisTableSlidePanel({ open, onClose, children }: ThisTableSlidePanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="bj-table-slide-overlay" role="presentation" onClick={onClose}>
      <aside
        className="bj-table-slide-drawer"
        role="dialog"
        aria-labelledby="this-table-slide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bj-table-slide-drawer__header">
          <h2 id="this-table-slide-title" className="bj-table-slide-drawer__title">
            This Table
          </h2>
          <button
            type="button"
            className="bj-table-slide-drawer__close secondary"
            onClick={onClose}
            aria-label="Close This Table panel"
          >
            ×
          </button>
        </div>
        <div className="bj-table-slide-drawer__body">{children}</div>
      </aside>
    </div>
  );
}

interface TableDetailsSlidePanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Slide-out for wager/shoe/protocol — separate from This Table bank/players nav. */
export function TableDetailsSlidePanel({ open, onClose, children }: TableDetailsSlidePanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="bj-table-slide-overlay bj-table-slide-overlay--details"
      role="presentation"
      onClick={onClose}
    >
      <aside
        className="bj-table-slide-drawer bj-table-slide-drawer--details"
        role="dialog"
        aria-labelledby="table-details-slide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bj-table-slide-drawer__header">
          <h2 id="table-details-slide-title" className="bj-table-slide-drawer__title">
            Table details
          </h2>
          <button
            type="button"
            className="bj-table-slide-drawer__close secondary"
            onClick={onClose}
            aria-label="Close table details"
          >
            ×
          </button>
        </div>
        <div className="bj-table-slide-drawer__body">{children}</div>
      </aside>
    </div>
  );
}

interface TablePanelOverlayProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  section?: SxmLayoutSection;
}

export function TablePanelOverlay({
  open,
  title,
  subtitle,
  onClose,
  children,
  wide = true,
  section,
}: TablePanelOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="invite-modal-overlay bj-table-panel-overlay" role="presentation" onClick={onClose}>
      <div
        {...(section
          ? sxmSectionProps(
              section,
              `invite-modal invite-modal--ledger${wide ? ' invite-modal--table-panel' : ''}`,
            )
          : {
              className: `invite-modal invite-modal--ledger${wide ? ' invite-modal--table-panel' : ''}`,
            })}
        role="dialog"
        aria-labelledby="table-panel-overlay-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="invite-modal__header">
          <h2 id="table-panel-overlay-title" className="invite-modal__title">
            {title}
          </h2>
          <button type="button" className="invite-modal__close secondary" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {subtitle && <p className="invite-modal__sub">{subtitle}</p>}
        <div className="bj-table-panel-overlay__body">{children}</div>
        <button type="button" className="secondary bj-table-panel-overlay__close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

interface PlayLedgerModalProps {
  open: boolean;
  onClose: () => void;
  gameState: GameState;
}

export function PlayLedgerModal({ open, onClose, gameState }: PlayLedgerModalProps) {
  return (
    <TablePanelOverlay
      open={open}
      title="Play Ledger"
      subtitle="Chip and table action history for this game — bets, wins, losses, and adjustments."
      onClose={onClose}
      section={SXM_LAYOUT.ledgerPanel}
    >
      <LedgerPanel gameState={gameState} variant="play" />
    </TablePanelOverlay>
  );
}

interface ScoreLedgerModalProps {
  open: boolean;
  onClose: () => void;
  activeTableId?: string | null;
  gameStatus?: GameState['tableMeta']['gameStatus'];
  viewerEmail?: string | null;
}

type LedgerViewTab = 'personal' | 'score';
type ScoreFilterMode = 'all' | 'person' | 'table';

function statusLabel(status: ScoreLedgerEntry['status']): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'settled':
      return 'Settled';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

function ScoreLedgerEntryList({ entries }: { entries: ScoreLedgerEntry[] }) {
  if (entries.length === 0) {
    return <p className="invite-modal__placeholder">No matching entries.</p>;
  }

  return (
    <ul className="score-ledger-list">
      {entries.map((entry) => (
        <li key={entry.id} className="score-ledger-list__item">
          <p className="score-ledger-list__owed">{entry.owedDescription}</p>
          <p className="score-ledger-list__meta">
            {entry.winnerName} won · {statusLabel(entry.status)} ·{' '}
            {new Date(entry.createdAt).toLocaleString()}
            {entry.tableName ? ` · ${entry.tableName}` : ''}
            {entry.roundCount ? ` · ${entry.roundCount} rounds` : ''}
          </p>
          <p className="score-ledger-list__wager">Played for: {entry.wagerDescription}</p>
        </li>
      ))}
    </ul>
  );
}

export function ScoreLedgerModal({
  open,
  onClose,
  activeTableId,
  gameStatus,
  viewerEmail = null,
}: ScoreLedgerModalProps) {
  const [viewTab, setViewTab] = useState<LedgerViewTab>('personal');
  const [scoreFilterMode, setScoreFilterMode] = useState<ScoreFilterMode>('all');
  const [personFilter, setPersonFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');

  const allEntries = useMemo(
    () =>
      open ? loadScoreLedgerDisplayEntries({ activeTableId, gameStatus }) : [],
    [open, activeTableId, gameStatus],
  );

  const personOptions = useMemo(() => listScoreLedgerPersonOptions(allEntries), [allEntries]);
  const tableOptions = useMemo(() => listScoreLedgerTableOptions(allEntries), [allEntries]);

  const personalEntries = useMemo(
    () => filterPersonalLedgerEntries(allEntries, viewerEmail ?? ''),
    [allEntries, viewerEmail],
  );

  const scoreEntries = useMemo(() => {
    let rows = allEntries;
    if (scoreFilterMode === 'person' && personFilter.trim()) {
      rows = filterScoreLedgerByPerson(rows, personFilter);
    }
    if (scoreFilterMode === 'table' && tableFilter.trim()) {
      rows = filterScoreLedgerByTable(rows, tableFilter);
    }
    return rows;
  }, [allEntries, scoreFilterMode, personFilter, tableFilter]);

  if (!open) {
    return null;
  }

  const displayedEntries = viewTab === 'personal' ? personalEntries : scoreEntries;

  return (
    <div className="invite-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="invite-modal invite-modal--ledger"
        role="dialog"
        aria-labelledby="score-ledger-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="invite-modal__header">
          <h2 id="score-ledger-title" className="invite-modal__title">
            Ledgers
          </h2>
          <button type="button" className="invite-modal__close secondary" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="score-ledger-tabs" role="tablist" aria-label="Ledger view">
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'personal'}
            className={`score-ledger-tabs__btn${viewTab === 'personal' ? '' : ' secondary'}`}
            onClick={() => setViewTab('personal')}
          >
            Personal ledger
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'score'}
            className={`score-ledger-tabs__btn${viewTab === 'score' ? '' : ' secondary'}`}
            onClick={() => setViewTab('score')}
          >
            Score ledger
          </button>
        </div>

        {viewTab === 'personal' ? (
          <p className="invite-modal__sub">
            Games you played — including practice tables you chose to save.
          </p>
        ) : (
          <>
            <p className="invite-modal__sub">
              Wager-level outcomes — who owes whom between friends. Not every hand or chip action.
            </p>
            <div className="score-ledger-filters">
              <label className="score-ledger-filters__field">
                <span>Filter</span>
                <select
                  className="score-ledger-filters__select"
                  value={scoreFilterMode}
                  onChange={(e) => setScoreFilterMode(e.target.value as ScoreFilterMode)}
                >
                  <option value="all">All games</option>
                  <option value="person">By person / opponent</option>
                  <option value="table">By table</option>
                </select>
              </label>
              {scoreFilterMode === 'person' && (
                <label className="score-ledger-filters__field">
                  <span>Person</span>
                  <input
                    type="text"
                    className="score-ledger-filters__input"
                    list="score-ledger-person-options"
                    value={personFilter}
                    onChange={(e) => setPersonFilter(e.target.value)}
                    placeholder="Name or email"
                  />
                  <datalist id="score-ledger-person-options">
                    {personOptions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </label>
              )}
              {scoreFilterMode === 'table' && (
                <label className="score-ledger-filters__field">
                  <span>Table</span>
                  <input
                    type="text"
                    className="score-ledger-filters__input"
                    list="score-ledger-table-options"
                    value={tableFilter}
                    onChange={(e) => setTableFilter(e.target.value)}
                    placeholder="Table name"
                  />
                  <datalist id="score-ledger-table-options">
                    {tableOptions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </label>
              )}
            </div>
          </>
        )}

        {displayedEntries.length === 0 ? (
          <p className="invite-modal__placeholder">
            {viewTab === 'personal'
              ? 'No saved games yet — use Add to Ledger when a table ends.'
              : 'No score entries yet — recorded when a table game ends.'}
          </p>
        ) : (
          <ScoreLedgerEntryList entries={displayedEntries} />
        )}

        <button type="button" className="secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
