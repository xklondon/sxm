import type { GameState } from '../types';
import { buildTableInfoDisplay } from './tableInfoDisplay';
import { TABLE_UX } from './tableUxContract';
import { SXM_LAYOUT, sxmSectionProps } from './sxmLayoutContract';
import './TableInfoBar.css';

interface TableInfoBarProps {
  gameState: GameState;
  viewerPersonId: string | null;
  /** Dealer: bank hand under cards. Felt/header: bank chip total only. */
  variant?: 'dealer' | 'header' | 'felt';
}

/** Bank value + bank chip balance — dealer variant under cards; felt row shows total only. */
export function TableInfoBar({ gameState, viewerPersonId, variant = 'dealer' }: TableInfoBarProps) {
  const { bankValue, bankChips, bankHolderLabel } = buildTableInfoDisplay(gameState, viewerPersonId);
  const isDealer = variant === 'dealer';
  const isHeader = variant === 'header';
  const isFelt = variant === 'felt';
  const showBankIdentity = Boolean(bankHolderLabel);

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
        {showBankIdentity ? (
          <span className="bj-table-info-bar__item bj-table-info-bar__bank-holder">
            Bank: {bankHolderLabel}
          </span>
        ) : null}
        <span className="bj-table-info-bar__item bj-table-info-bar__bank-chips">
          Bank Total: {bankChips !== null ? bankChips : '—'}
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
        'bj-table-info-bar--dealer-hand',
      )}
      aria-label="Bank hand"
    >
      {showBankIdentity ? (
        <span className="bj-table-info-bar__item bj-table-info-bar__bank-holder">
          Bank: {bankHolderLabel}
        </span>
      ) : null}
      <span className="bj-table-info-bar__item bj-table-info-bar__bank-value">
        {showBankIdentity ? 'Bank has ' : 'Bank Hand: '}
        {bankValue !== null ? <span className="bj-bank-hand__value">{bankValue}</span> : '—'}
      </span>
    </div>
  );
}
