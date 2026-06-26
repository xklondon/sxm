import { useEffect, useRef, useState } from 'react';
import { PokerBlindsControl } from './PokerBlindsControl';

export interface PokerTableMenuProps {
  smallBlind: number;
  bigBlind: number;
  canEditBlinds?: boolean;
  onSaveBlinds?: (smallBlind: number, bigBlind: number) => void;
  onInviteTable?: () => void;
  onLeaveTable?: () => void;
  onEndChallenge?: () => void;
  onStartHand?: () => void;
  onShuffleDeck?: () => void;
  showInvite?: boolean;
  showStartHand?: boolean;
  showShuffleDeck?: boolean;
  showEndChallenge?: boolean;
  startHandLabel?: string;
}

export function PokerTableMenu({
  smallBlind,
  bigBlind,
  canEditBlinds = false,
  onSaveBlinds,
  onInviteTable,
  onLeaveTable,
  onEndChallenge,
  onStartHand,
  onShuffleDeck,
  showInvite = false,
  showStartHand = false,
  showShuffleDeck = false,
  showEndChallenge = false,
  startHandLabel = "Start Hold'em hand",
}: PokerTableMenuProps) {
  const [open, setOpen] = useState(false);
  const [showBlindsEditor, setShowBlindsEditor] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setShowBlindsEditor(false);
      }
    }
    document.addEventListener('mousedown', handlePointer);
    return () => document.removeEventListener('mousedown', handlePointer);
  }, [open]);

  function closeMenu() {
    setOpen(false);
    setShowBlindsEditor(false);
  }

  return (
    <div className="poker-table-menu" ref={rootRef}>
      <button
        type="button"
        className="poker-table-menu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        This Table
      </button>
      {open && (
        <div className="poker-table-menu__panel" role="menu" aria-label="This Table menu">
          {showInvite && onInviteTable && (
            <button
              type="button"
              className="poker-table-menu__item"
              role="menuitem"
              onClick={() => {
                closeMenu();
                onInviteTable();
              }}
            >
              Invite to table
            </button>
          )}
          {canEditBlinds && onSaveBlinds && (
            <>
              <button
                type="button"
                className="poker-table-menu__item"
                role="menuitem"
                aria-expanded={showBlindsEditor}
                onClick={() => setShowBlindsEditor((value) => !value)}
              >
                Edit blinds
              </button>
              {showBlindsEditor && (
                <div className="poker-table-menu__blinds">
                  <PokerBlindsControl
                    smallBlind={smallBlind}
                    bigBlind={bigBlind}
                    editable
                    hideLabel
                    onSave={(sb, bb) => {
                      onSaveBlinds(sb, bb);
                      closeMenu();
                    }}
                  />
                </div>
              )}
            </>
          )}
          {showShuffleDeck && onShuffleDeck && (
            <button
              type="button"
              className="poker-table-menu__item"
              role="menuitem"
              onClick={() => {
                closeMenu();
                onShuffleDeck();
              }}
            >
              Shuffle deck
            </button>
          )}
          {showStartHand && onStartHand && (
            <button
              type="button"
              className="poker-table-menu__item"
              role="menuitem"
              onClick={() => {
                closeMenu();
                onStartHand();
              }}
            >
              {startHandLabel}
            </button>
          )}
          {showEndChallenge && onEndChallenge && (
            <button
              type="button"
              className="poker-table-menu__item"
              role="menuitem"
              onClick={() => {
                closeMenu();
                onEndChallenge();
              }}
            >
              End challenge
            </button>
          )}
          {onLeaveTable && (
            <button
              type="button"
              className="poker-table-menu__item poker-table-menu__item--danger"
              role="menuitem"
              onClick={() => {
                closeMenu();
                onLeaveTable();
              }}
            >
              Leave table
            </button>
          )}
        </div>
      )}
    </div>
  );
}
