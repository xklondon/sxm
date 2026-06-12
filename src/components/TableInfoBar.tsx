import type { GameState } from '../types';
import { buildTableInfoDisplay } from './tableInfoDisplay';
import { TABLE_UX } from './tableUxContract';
import { SXM_LAYOUT, sxmSectionProps } from './sxmLayoutContract';
import { boxValueSpanClassName } from './boxHandValueDisplay';
import { BOX_CARD_VALUE, BOX_CARD_VALUE_ABOVE } from './cardViewBox';
import './TableInfoBar.css';

interface TableInfoBarProps {
  gameState: GameState;
  viewerPersonId: string | null;
  /** Masked visual state for paced card reveal — bank hand value follows visible cards only. */
  displayState?: GameState;
  /** Dealer: bank hand under cards. Felt/header: bank chip total only. */
  variant?: 'dealer' | 'header' | 'felt';
}

/** Bank value + bank chip balance — dealer variant under cards; felt row shows total only. */
export function TableInfoBar({
  gameState,
  viewerPersonId,
  displayState,
  variant = 'dealer',
}: TableInfoBarProps) {
  const { bankValue, bankChips, bankHolderLabel } = buildTableInfoDisplay(
    gameState,
    viewerPersonId,
    displayState ?? gameState,
  );
  const isDealer = variant === 'dealer';
  const isHeader = variant === 'header';
  const isFelt = variant === 'felt';
  const showBankIdentity = Boolean(bankHolderLabel);
  const bankChipText = bankChips !== null ? bankChips : '—';

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
          <span className="bj-table-info-bar__item bj-table-info-bar__bank-summary">
            Bank: {bankHolderLabel} {bankChipText}
          </span>
        ) : (
          <span className="bj-table-info-bar__item bj-table-info-bar__bank-chips">
            {bankChipText}
          </span>
        )}
      </div>
    );
  }

  const bankHandLabel = bankValue !== null ? String(bankValue) : '—';

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
      <span
        className={[
          boxValueSpanClassName(Boolean(bankValue), false),
          TABLE_UX.cardColumnValueAbove,
          BOX_CARD_VALUE,
          BOX_CARD_VALUE_ABOVE,
        ].join(' ')}
        aria-hidden={bankValue !== null ? undefined : 'true'}
      >
        {bankHandLabel}
      </span>
    </div>
  );
}
