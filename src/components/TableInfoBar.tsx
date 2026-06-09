import type { GameState } from '../types';
import { buildTableInfoDisplay } from './tableInfoDisplay';
import { TABLE_UX } from './tableUxContract';
import { SXM_LAYOUT, sxmSectionProps } from './sxmLayoutContract';
import './TableInfoBar.css';

interface TableInfoBarProps {
  gameState: GameState;
  viewerPersonId: string | null;
  /** Dealer placement stacks bank value/chips under dealer cards. Header variant sits under page title. Felt variant is first row inside table shell. */
  variant?: 'dealer' | 'header' | 'felt';
}

/** Bank value + bank chip balance — dealer variant under cards; header variant under page title. */
export function TableInfoBar({ gameState, viewerPersonId, variant = 'dealer' }: TableInfoBarProps) {
  const { bankValue, bankChips } = buildTableInfoDisplay(gameState, viewerPersonId);
  const isDealer = variant === 'dealer';
  const isHeader = variant === 'header';
  const isFelt = variant === 'felt';

  if (isHeader || isFelt) {
    return (
      <div
        {...sxmSectionProps(
          SXM_LAYOUT.balanceDisplay,
          TABLE_UX.tableInfoBar,
          isHeader ? TABLE_UX.headerBankInfo : '',
          isFelt ? 'bj-table-info-bar--felt-row' : 'bj-table-info-bar--header-row',
        )}
        aria-label="Bank information"
      >
        <span className="bj-table-info-bar__item bj-table-info-bar__bank-chips">
          Bank Total: {bankChips !== null ? bankChips : '—'}
        </span>
        <span className="bj-table-info-bar__divider" aria-hidden="true">
          |
        </span>
        <span className="bj-table-info-bar__item bj-table-info-bar__bank-value">
          Bank Hand: {bankValue !== null ? bankValue : '—'}
        </span>
      </div>
    );
  }

  return (
    <div
      {...sxmSectionProps(
        SXM_LAYOUT.bankSummary,
        TABLE_UX.tableInfoBar,
        isDealer ? TABLE_UX.dealerBankInfo : '',
      )}
      aria-label="Bank information"
    >
      {bankValue !== null ? (
        <span className="bj-table-info-bar__item bj-table-info-bar__bank-value">
          Bank: {bankValue}
        </span>
      ) : (
        <span className="bj-table-info-bar__item bj-table-info-bar__bank-value bj-table-info-bar__item--placeholder" aria-hidden="true">
          &nbsp;
        </span>
      )}
      {bankChips !== null ? (
        <span className="bj-table-info-bar__item bj-table-info-bar__bank-chips">
          Bank chips: {bankChips}
        </span>
      ) : (
        <span className="bj-table-info-bar__item bj-table-info-bar__bank-chips bj-table-info-bar__item--placeholder" aria-hidden="true">
          &nbsp;
        </span>
      )}
    </div>
  );
}
