import './TableDetailsPanel.css';

export interface TableDetailsPanelProps {
  playingFor: string;
  minimumBet: number;
  canChangeMinBet: boolean;
  onChangeMinBet: () => void;
  deckCount: number;
  totalCards: number;
  remaining: number;
  hasDeck: boolean;
  dealSpeedLabel: string;
  canChangeDealSpeed: boolean;
  onCycleDealSpeed: () => void;
  protocolLabel: string;
  canChangeProtocol: boolean;
  onChangeProtocol: () => void;
  gameEnded: boolean;
  canResetTable?: boolean;
  onResetTable?: () => void;
  /** Session blackjack wins per occupied box, e.g. "Box 1: 2, Box 2: 0". */
  blackjackCountByBox?: string;
}

/** Table wager/shoe/protocol settings — shown in the Table details slide-out only. */
export function TableDetailsPanelContent({
  playingFor,
  minimumBet,
  canChangeMinBet,
  onChangeMinBet,
  deckCount,
  totalCards,
  remaining,
  hasDeck,
  dealSpeedLabel,
  canChangeDealSpeed,
  onCycleDealSpeed,
  protocolLabel,
  canChangeProtocol,
  onChangeProtocol,
  gameEnded,
  canResetTable = false,
  onResetTable,
  blackjackCountByBox,
}: TableDetailsPanelProps) {
  return (
    <div className="table-details-panel" aria-label="Table details">
      <div className="table-details-panel__chip">
        <span className="table-details-panel__k">Playing for</span>
        <span className="table-details-panel__v">{playingFor}</span>
      </div>
      <div className="table-details-panel__chip table-details-panel__chip--bet">
        <span className="table-details-panel__k">Minimum bet</span>
        <span className="table-details-panel__v">
          {minimumBet}
          {canChangeMinBet && !gameEnded && (
            <button
              type="button"
              className="table-details-panel__chip-btn"
              onClick={onChangeMinBet}
              aria-label="Change minimum bet"
              title="Change minimum bet"
            >
              $
            </button>
          )}
        </span>
      </div>
      {hasDeck && (
        <div className="table-details-panel__chip">
          <span className="table-details-panel__k">Shoe</span>
          <span className="table-details-panel__v">
            {deckCount}-deck · {totalCards} / {remaining}
          </span>
        </div>
      )}
      <div className="table-details-panel__chip">
        <span className="table-details-panel__k">Deal speed</span>
        <span className="table-details-panel__v">
          {canChangeDealSpeed && !gameEnded ? (
            <button
              type="button"
              className="table-details-panel__chip-btn table-details-panel__chip-btn--meta"
              onClick={onCycleDealSpeed}
              aria-label="Change dealing speed"
              title="Change dealing speed"
            >
              <span className="table-details-panel__chip-icon" aria-hidden="true">
                ⏱
              </span>
              {dealSpeedLabel}
            </button>
          ) : (
            <>
              <span className="table-details-panel__chip-icon" aria-hidden="true">
                ⏱
              </span>
              {dealSpeedLabel}
            </>
          )}
        </span>
      </div>
      <div className="table-details-panel__chip">
        <span className="table-details-panel__k">Protocol</span>
        <span className="table-details-panel__v">
          {canChangeProtocol && !gameEnded ? (
            <button
              type="button"
              className="table-details-panel__chip-btn table-details-panel__chip-btn--meta"
              onClick={onChangeProtocol}
              aria-label="Change protocol"
              title="Change protocol"
            >
              <span className="table-details-panel__chip-icon" aria-hidden="true">
                ⚙
              </span>
              {protocolLabel}
            </button>
          ) : (
            <>
              <span className="table-details-panel__chip-icon" aria-hidden="true">
                ⚙
              </span>
              {protocolLabel}
            </>
          )}
        </span>
      </div>
      <div className="table-details-panel__chip">
        <span className="table-details-panel__k">Black Jacks per Box</span>
        <span className="table-details-panel__v">{blackjackCountByBox ?? '—'}</span>
      </div>
      {canResetTable && onResetTable && (
        <div className="table-details-panel__reset">
          <button
            type="button"
            className="table-details-panel__reset-btn secondary"
            onClick={onResetTable}
          >
            Reset table
          </button>
          <p className="table-details-panel__reset-hint">
            Start a new game with these players
          </p>
        </div>
      )}
    </div>
  );
}
