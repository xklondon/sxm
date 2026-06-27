import type { CSSProperties } from 'react';
import type { ZilchVisiblePlayer } from '../../engine/dice/zilch/zilchVisiblePlayers';

interface ZilchStarterSpinnerProps {
  players: ZilchVisiblePlayer[];
  activeIndex: number;
  spinning: boolean;
  starterPlayerId: string | null;
  disabled: boolean;
  onRandomiseStarter: () => void;
  setupHint?: string;
}

export function ZilchStarterSpinner({
  players,
  activeIndex,
  spinning,
  starterPlayerId,
  disabled,
  onRandomiseStarter,
  setupHint,
}: ZilchStarterSpinnerProps) {
  const count = Math.max(players.length, 1);
  const pointerAngle = spinning
    ? undefined
    : (360 / count) * activeIndex - 90;

  return (
    <div
      className={`zilch-starter-spinner${spinning ? ' zilch-starter-spinner--spinning' : ''}`}
      data-player-count={count}
      aria-label="Randomise starter"
    >
      <div
        className="zilch-starter-spinner__dial"
        style={
          pointerAngle !== undefined
            ? ({ '--pointer-angle': `${pointerAngle}deg` } as CSSProperties)
            : undefined
        }
      >
        <span className="zilch-starter-spinner__arrow" aria-hidden="true" />
        <div className="zilch-starter-spinner__hub" />
        {players.map((player, index) => {
          const angle = (360 / count) * index - 90;
          const isActive = index === activeIndex;
          const isStarter = player.playerId === starterPlayerId;
          return (
            <span
              key={player.playerId}
              className={`zilch-starter-spinner__marker${
                isActive ? ' zilch-starter-spinner__marker--active' : ''
              }${isStarter ? ' zilch-starter-spinner__marker--starter' : ''}`}
              style={{ '--marker-angle': `${angle}deg` } as CSSProperties}
              title={player.name}
            />
          );
        })}
      </div>
      <p className="zilch-starter-spinner__label" aria-live="polite">
        {spinning
          ? `Selecting… ${players[activeIndex]?.name ?? ''}`
          : starterPlayerId
            ? `${players.find((p) => p.playerId === starterPlayerId)?.name ?? 'Player'} starts`
            : 'Randomise who starts'}
      </p>
      <button type="button" onClick={onRandomiseStarter} disabled={disabled || players.length === 0}>
        Randomise starter
      </button>
      {setupHint && (
        <p className="zilch-starter-spinner__hint">{setupHint}</p>
      )}
    </div>
  );
}
