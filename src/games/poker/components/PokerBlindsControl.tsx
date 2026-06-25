import { useState } from 'react';

interface PokerBlindsControlProps {
  smallBlind: number;
  bigBlind: number;
  editable: boolean;
  onSave?: (smallBlind: number, bigBlind: number) => void;
}

export function PokerBlindsControl({
  smallBlind,
  bigBlind,
  editable,
  onSave,
}: PokerBlindsControlProps) {
  const [open, setOpen] = useState(false);
  const [sbInput, setSbInput] = useState(String(smallBlind));
  const [bbInput, setBbInput] = useState(String(bigBlind));
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const sb = Number.parseInt(sbInput, 10);
    const bb = Number.parseInt(bbInput, 10);
    if (!Number.isFinite(sb) || sb <= 0 || !Number.isFinite(bb) || bb <= 0) {
      setError('Blinds must be positive numbers.');
      return;
    }
    if (bb <= sb) {
      setError('Big blind must be greater than the small blind.');
      return;
    }
    setError(null);
    onSave?.(sb, bb);
    setOpen(false);
  }

  return (
    <div className="poker-blinds">
      <span className="poker-blinds__label">
        Blinds {smallBlind}/{bigBlind}
      </span>
      {editable && (
        <>
          <button
            type="button"
            className="secondary poker-blinds__edit"
            onClick={() => {
              setSbInput(String(smallBlind));
              setBbInput(String(bigBlind));
              setOpen((value) => !value);
            }}
            aria-expanded={open}
          >
            Edit blinds
          </button>
          {open && (
            <div className="poker-blinds__panel">
              <label className="poker-blinds__field">
                Small blind
                <input
                  type="number"
                  min={1}
                  value={sbInput}
                  onChange={(e) => setSbInput(e.target.value)}
                />
              </label>
              <label className="poker-blinds__field">
                Big blind
                <input
                  type="number"
                  min={1}
                  value={bbInput}
                  onChange={(e) => setBbInput(e.target.value)}
                />
              </label>
              <button type="button" onClick={handleSave}>
                Save for next hand
              </button>
              {error && (
                <p className="poker-blinds__error" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
