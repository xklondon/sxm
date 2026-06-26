interface PokerPotAreaProps {
  pot: number;
  currentBet: number;
  sidePotCount?: number;
  payoutSummary?: string[];
  winningHandLabel?: string;
}

export function PokerPotArea({
  pot,
  currentBet,
  sidePotCount = 0,
  payoutSummary = [],
  winningHandLabel,
}: PokerPotAreaProps) {
  return (
    <section className="poker-pot poker-hr-pot" aria-label="Pot">
      <div className="poker-hr-pot__main">
        <span className="poker-hr-pot__label">Pot</span>
        <strong className="poker-hr-pot__amount">{pot.toLocaleString()}</strong>
      </div>
      {currentBet > 0 && (
        <p className="poker-hr-pot__bet">
          Bet <span>{currentBet.toLocaleString()}</span>
        </p>
      )}
      {sidePotCount > 1 && (
        <p className="poker-hr-pot__side">{sidePotCount} side pots</p>
      )}
      {winningHandLabel && (
        <p className="poker-hr-pot__hand">Winning hand: {winningHandLabel}</p>
      )}
      {payoutSummary.length > 0 && (
        <ul className="poker-pot__payouts poker-hr-pot__payouts" aria-label="Pot payouts">
          {payoutSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
