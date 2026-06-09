import './EntryLobbyScreen.css';
import { ActiveTablesList } from '../components/ActiveTablesList';
import { LoadTableList, type LoadTableEntry } from '../components/LoadTableList';

export type EntryLobbyPanel = 'home' | 'join' | 'load';

interface EntryLobbyScreenProps {
  panel: EntryLobbyPanel;
  onPanelChange: (panel: EntryLobbyPanel) => void;
  onOpenNewTable: () => void;
  onOpenTable: (tableId: string) => void;
  onLoadEntry: (entry: LoadTableEntry) => void;
  onlineMode: boolean;
  canOwnTables: boolean;
  showPeopleAdmin?: boolean;
  onOpenPeople?: () => void;
}

export function EntryLobbyScreen({
  panel,
  onPanelChange,
  onOpenNewTable,
  onOpenTable,
  onLoadEntry,
  onlineMode,
  canOwnTables,
  showPeopleAdmin,
  onOpenPeople,
}: EntryLobbyScreenProps) {
  if (panel === 'join') {
    return (
      <main className="entry-lobby">
        <ActiveTablesList onOpenTable={onOpenTable} onBack={() => onPanelChange('home')} />
      </main>
    );
  }

  if (panel === 'load') {
    return (
      <main className="entry-lobby">
        <LoadTableList
          onlineMode={onlineMode}
          onLoad={onLoadEntry}
          onBack={() => onPanelChange('home')}
        />
      </main>
    );
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
          <button type="button" onClick={onOpenNewTable} disabled={onlineMode && !canOwnTables}>
            Open New Table
          </button>
          {onlineMode && (
            <button type="button" className="secondary" onClick={() => onPanelChange('join')}>
              Join a Table
            </button>
          )}
          <button type="button" className="secondary" onClick={() => onPanelChange('load')}>
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
    </main>
  );
}
