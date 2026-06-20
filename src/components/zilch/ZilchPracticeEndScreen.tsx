import type { ZilchGameState } from '../../engine/dice/zilch';
import { getZilchWinnerId } from '../../engine/dice/zilch';
import type { ZilchVisiblePlayer } from '../../engine/dice/zilch/zilchVisiblePlayers';

interface ZilchPracticeEndScreenProps {
  zilch: ZilchGameState;
  visiblePlayers: ZilchVisiblePlayer[];
  onStartNewRound?: () => void;
  onBackToMenu?: () => void;
}

export function ZilchPracticeEndScreen({
  zilch,
  visiblePlayers,
  onStartNewRound,
  onBackToMenu,
}: ZilchPracticeEndScreenProps) {
  const winnerId = getZilchWinnerId(zilch);
  const winner = visiblePlayers.find((p) => p.playerId === winnerId);

  const scores = [...visiblePlayers]
    .map((p) => ({
      id: p.playerId,
      name: p.name,
      score: zilch.totalScoresByPlayerId[p.playerId] ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="zilch-end-screen" role="region" aria-label="Game over">
      <h3 className="zilch-end-screen__title">Game over</h3>
      <p className="zilch-end-screen__winner">
        Winner: <strong>{winner?.name ?? winnerId ?? '—'}</strong>
      </p>
      <ul className="zilch-end-screen__scores">
        {scores.map((entry) => (
          <li key={entry.id} className={entry.id === winnerId ? 'zilch-end-screen__score--winner' : ''}>
            <span>{entry.name}</span>
            <span>{entry.score}</span>
          </li>
        ))}
      </ul>
      <div className="zilch-end-screen__actions">
        {onStartNewRound && (
          <button type="button" onClick={onStartNewRound}>
            Start new round
          </button>
        )}
        {onBackToMenu && (
          <button type="button" className="secondary" onClick={onBackToMenu}>
            Back to menu
          </button>
        )}
      </div>
    </div>
  );
}
