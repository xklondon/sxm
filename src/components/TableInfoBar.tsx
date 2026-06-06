import type { GameState } from '../types';
import { buildTableInfoDisplay } from './tableInfoDisplay';
import { TABLE_UX } from './tableUxContract';
import './TableInfoBar.css';

interface TableInfoBarProps {
  gameState: GameState;
  viewerPersonId: string | null;
  /** Dealer placement stacks bank value/chips under dealer cards. Header variant sits under page title. */
  variant?: 'dealer' | 'header';
}

/** Bank value + bank chip balance — dealer variant under cards; header variant under page title. */
export function TableInfoBar({ gameState, viewerPersonId, variant = 'dealer' }: TableInfoBarProps) {
  const { bankValue, bankChips } = buildTableInfoDisplay(gameState, viewerPersonId);
  const isDealer = variant === 'dealer';
  const isHeader = variant === 'header';

  return (
    <div
      className={[
        TABLE_UX.tableInfoBar,
        isDealer ? TABLE_UX.dealerBankInfo : '',
        isHeader ? TABLE_UX.headerBankInfo : '',
      ].filter(Boolean).join(' ')}
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
