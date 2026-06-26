import { POKER_TEMPLATE_CLOTH } from '../pokerTemplateContract';
import { POKER0_CLOTH_TITLE } from '../poker0LayoutContract';

export interface PokerFeltClothLayerProps {
  tableName: string;
}

/** Poker 0 symmetric oval cloth — embossed table name at center. */
export function PokerFeltClothLayer({ tableName }: PokerFeltClothLayerProps) {
  const clothTitle = tableName.trim().toUpperCase() || 'TABLE';

  return (
    <div className={`poker-felt-cloth-layer ${POKER_TEMPLATE_CLOTH}`} aria-hidden="true">
      <div className="poker-felt-cloth-layer__inner-rail" />
      <div className="poker-felt-cloth-layer__texture" />
      <p className={POKER0_CLOTH_TITLE} data-testid="poker-cloth-table-name">
        {clothTitle}
      </p>
    </div>
  );
}
