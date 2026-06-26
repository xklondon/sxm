import { POKER0_HEADER_BLINDS, POKER0_HEADER_CONTROLS, POKER0_HEADER_DEAL, POKER0_HEADER_IDENTITY, POKER0_HEADER_POT } from '../poker0LayoutContract';
import { POKER_TEMPLATE_TOPBAR } from '../pokerTemplateContract';

export interface PokerTableHeaderProps {
  tableName: string;
  playingForText?: string;
  smallBlind: number;
  bigBlind: number;
  pot: number;
  statusHint?: string;
  startHandBlockReason?: string | null;
  dealLabel?: string;
  showDeal?: boolean;
  dealDisabled?: boolean;
  tablePanelOpen?: boolean;
  onToggleTablePanel?: () => void;
  onStartHand?: () => void;
}

/** Poker 0 header — identity left; POT | BLINDS | Deal | This Table. */
export function PokerTableHeader({
  tableName,
  playingForText,
  smallBlind,
  bigBlind,
  pot,
  statusHint,
  startHandBlockReason = null,
  dealLabel = 'Deal Cards',
  showDeal = false,
  dealDisabled = false,
  tablePanelOpen = false,
  onToggleTablePanel,
  onStartHand,
}: PokerTableHeaderProps) {
  const statusText =
    showDeal && dealDisabled && startHandBlockReason
      ? startHandBlockReason
      : !showDeal
        ? statusHint
        : null;

  return (
    <header className={`poker-table-shell__topbar ${POKER_TEMPLATE_TOPBAR}`}>
      <div className={POKER0_HEADER_IDENTITY} data-testid="poker-header-identity">
        <h1 className="poker0-header__table-name" data-testid="poker-header-table-name">
          {tableName}
        </h1>
        {playingForText ? (
          <p className="poker0-header__playing-for" data-testid="poker-header-playing-for">
            {playingForText}
          </p>
        ) : null}
      </div>

      <div className={POKER0_HEADER_CONTROLS} data-testid="poker-header-metrics">
        <div className={POKER0_HEADER_POT} data-testid="poker-header-pot">
          <span className="poker0-header__label">Pot</span>
          <strong className="poker0-header__value">{pot.toLocaleString()}</strong>
        </div>
        <span className="poker0-header__divider" aria-hidden="true">
          |
        </span>
        <div className={POKER0_HEADER_BLINDS} data-testid="poker-header-blinds">
          <span className="poker0-header__label">Blinds</span>
          <strong className="poker0-header__value">
            {smallBlind}/{bigBlind}
          </strong>
        </div>
        {showDeal && onStartHand ? (
          <>
            <span className="poker0-header__divider" aria-hidden="true">
              |
            </span>
            <button
              type="button"
              className={POKER0_HEADER_DEAL}
              data-testid="poker-header-deal"
              disabled={dealDisabled}
              onClick={onStartHand}
            >
              {dealLabel}
            </button>
          </>
        ) : null}
        <button
          type="button"
          className={`poker-table-shell__this-table poker0-header__menu${tablePanelOpen ? ' poker-table-shell__this-table--active' : ''}`}
          data-testid="poker-header-this-table"
          aria-expanded={tablePanelOpen}
          onClick={onToggleTablePanel}
        >
          This Table
        </button>
      </div>

      {statusText ? (
        <p className="poker0-header__status" data-testid="poker-header-status">
          {statusText}
        </p>
      ) : null}
    </header>
  );
}
