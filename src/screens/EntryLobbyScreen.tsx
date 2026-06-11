import { useMemo, useState } from 'react';
import './EntryLobbyScreen.css';
import { ActiveTablesList } from '../components/ActiveTablesList';
import { EntryLobbySlideOut } from '../components/EntryLobbySlideOut';
import { LoadTableList, type LoadTableEntry } from '../components/LoadTableList';
import { NewTableOverlay } from '../components/NewTableOverlay';
import { TableStakePanel } from '../components/TableStakePanel';
import { createNewBlackjackTable } from '../engine/session';
import type { TableStakeSetupInput } from '../engine/session/tableSetup';

export type EntryLobbySlideOutKind = 'new' | 'join' | 'load';

interface EntryLobbyScreenProps {
  onConfirmNewTable: (input: TableStakeSetupInput) => void | Promise<void>;
  onOpenTable: (tableId: string) => void;
  onLoadEntry: (entry: LoadTableEntry) => void;
  onlineMode: boolean;
  canOwnTables: boolean;
  showPeopleAdmin?: boolean;
  onOpenPeople?: () => void;
}

export function EntryLobbyScreen({
  onConfirmNewTable,
  onOpenTable,
  onLoadEntry,
  onlineMode,
  canOwnTables,
  showPeopleAdmin,
  onOpenPeople,
}: EntryLobbyScreenProps) {
  const [slideOut, setSlideOut] = useState<EntryLobbySlideOutKind | null>(null);
  const newTableSeed = useMemo(() => createNewBlackjackTable(), [slideOut === 'new']);

  function closeSlideOut() {
    setSlideOut(null);
  }

  async function handleConfirmNewTable(input: TableStakeSetupInput) {
    await onConfirmNewTable(input);
    closeSlideOut();
  }

  function handleLoadEntry(entry: LoadTableEntry) {
    onLoadEntry(entry);
    closeSlideOut();
  }

  function handleOpenTable(tableId: string) {
    onOpenTable(tableId);
    closeSlideOut();
  }

  return (
    <main className="entry-lobby">
      <div className="entry-lobby__card">
        <p className="entry-lobby__eyebrow">
          {onlineMode ? 'Online tables · Magic-link login' : 'Local game · Virtual chips'}
        </p>
        <h1 className="entry-lobby__title">Card Dealer</h1>
        <p className="entry-lobby__subtitle">
          Choose how to start. Your last table is not opened automatically on reload.
        </p>
        <div className="entry-lobby__actions">
          <button
            type="button"
            onClick={() => setSlideOut('new')}
            disabled={onlineMode && !canOwnTables}
          >
            Open New Table
          </button>
          {onlineMode && (
            <button type="button" className="secondary" onClick={() => setSlideOut('join')}>
              Join a Table
            </button>
          )}
          <button type="button" className="secondary" onClick={() => setSlideOut('load')}>
            Load a Table
          </button>
          {showPeopleAdmin && onOpenPeople && (
            <button type="button" className="secondary" onClick={onOpenPeople}>
              People admin
            </button>
          )}
        </div>
        {onlineMode && !canOwnTables && (
          <p className="entry-lobby__hint">You need table-owner permission to create a new table.</p>
        )}
      </div>

      {/* Canonical New Table flow — do not fork: lobby uses NewTableOverlay + embedded TableStakePanel. */}
      <NewTableOverlay
        open={slideOut === 'new'}
        title="Open New Table"
        ariaLabel="Open New Table setup"
        onClose={closeSlideOut}
      >
        <TableStakePanel
          gameState={newTableSeed}
          mode="new"
          embeddedInOverlay
          onConfirm={() => {}}
          onConfirmNewTable={handleConfirmNewTable}
        />
      </NewTableOverlay>

      <EntryLobbySlideOut
        open={slideOut === 'join'}
        title="Join a Table"
        onClose={closeSlideOut}
      >
        <ActiveTablesList onOpenTable={handleOpenTable} />
      </EntryLobbySlideOut>

      <EntryLobbySlideOut
        open={slideOut === 'load'}
        title="Load a Table"
        onClose={closeSlideOut}
      >
        <LoadTableList onlineMode={onlineMode} onLoad={handleLoadEntry} />
      </EntryLobbySlideOut>
    </main>
  );
}
