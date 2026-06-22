import type { ZilchGameState } from '../../engine/dice/zilch';
import { commandStatusForPhase } from '../../engine/dice/zilch';

interface ZilchCommandProps {
  zilch: ZilchGameState | null;
  playerNames: Record<string, string>;
  canAct: boolean;
  actionError?: string | null;
  zilchRevealCountdown?: number;
  className?: string;
}

export function ZilchCommand({
  zilch,
  playerNames,
  canAct,
  actionError = null,
  zilchRevealCountdown = 0,
  className = '',
}: ZilchCommandProps) {
  const message = zilch
    ? commandStatusForPhase(zilch, playerNames, canAct)
    : 'Invite players, then start the Zilch game.';

  const bannerClass =
    zilch?.phase === 'zilch-reveal' || zilch?.phase === 'zilch' || zilch?.lastZilchPlayerId
      ? ' zilch-panel__banner--zilch'
      : zilch?.phase === 'final-round'
        ? ' zilch-panel__banner--final'
        : zilch?.phase === 'completed'
          ? ' zilch-panel__banner--winner'
          : '';

  return (
    <>
      {actionError && (
        <p className="zilch-panel__banner zilch-panel__banner--error" role="alert">
          {actionError}
        </p>
      )}
      <p className={`zilch-panel__banner${bannerClass}${className}`} role="status">
        {message}
        {zilch?.phase === 'zilch-reveal' && zilchRevealCountdown > 0 && (
          <span className="zilch-panel__banner-countdown">
            {' '}
            Next player in {zilchRevealCountdown}…
          </span>
        )}
      </p>
    </>
  );
}
