interface PokerPotAreaProps {
  pot: number;
  currentBet: number;
  smallBlind: number;
  bigBlind: number;
  sidePotCount?: number;
  payoutSummary?: string[];
  winningHandLabel?: string;
}

export function PokerPotArea({
  pot,
  currentBet,
  smallBlind,
  bigBlind,
  sidePotCount = 0,
  payoutSummary = [],
  winningHandLabel,
}: PokerPotAreaProps) {
  return (
    <section className="poker-pot" aria-label="Pot and blinds">
      <div className="poker-pot__main">
        <span className="poker-pot__label">Pot</span>
        <strong className="poker-pot__amount">{pot.toLocaleString()}</strong>
      </div>
      {sidePotCount > 1 && (
        <p className="poker-pot__side-count">{sidePotCount} side pots</p>
      )}
      {winningHandLabel && (
        <p className="poker-pot__hand-label">Winning hand: {winningHandLabel}</p>
      )}
      {payoutSummary.length > 0 && (
        <ul className="poker-pot__payouts" aria-label="Pot payouts">
          {payoutSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <dl className="poker-pot__meta">
        <div>
          <dt>Current bet</dt>
          <dd>{currentBet}</dd>
        </div>
        <div>
          <dt>Blinds</dt>
          <dd>
            {smallBlind}/{bigBlind}
          </dd>
        </div>
      </dl>
    </section>
  );
}
