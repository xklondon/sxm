import './StartScreen.css';

interface StartScreenProps {
  onNewGame: () => void;
  onlineMode?: boolean;
  canOwnTables?: boolean;
  onOpenPeople?: () => void;
  showPeopleAdmin?: boolean;
}

export function StartScreen({
  onNewGame,
  onlineMode = false,
  canOwnTables = true,
  onOpenPeople,
  showPeopleAdmin = false,
}: StartScreenProps) {
  return (
    <main className="start-screen">
      <div className="start-screen__card">
        <p className="start-screen__eyebrow">
          {onlineMode ? 'Online tables · Magic-link login' : 'Local game · Virtual chips'}
        </p>
        <h1 className="start-screen__title">Card Dealer</h1>
        <p className="start-screen__subtitle">
          {onlineMode
            ? 'Create a hosted table, invite friends, and play synchronized blackjack.'
            : 'Shuffle, deal, and track table balances with friends in the same room.'}
        </p>

        <div className="start-screen__actions">
          <button type="button" onClick={onNewGame} disabled={onlineMode && !canOwnTables}>
            {onlineMode ? 'New online table' : 'New Game'}
          </button>
          {onlineMode && !canOwnTables && (
            <p className="start-screen__hint">You need table-owner permission to create a table.</p>
          )}
          {showPeopleAdmin && onOpenPeople && (
            <button type="button" className="secondary" onClick={onOpenPeople}>
              People admin
            </button>
          )}
          <button type="button" className="secondary" disabled title="Coming in Phase 6">
            Load Previous Game
          </button>
          <button type="button" className="secondary" disabled title="Coming in Phase 5">
            Settings
          </button>
        </div>
      </div>
    </main>
  );
}
