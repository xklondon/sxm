import { PokerActionPanel } from './PokerActionPanel';
import { PokerBlindsControl } from './PokerBlindsControl';
import { PokerChatDock } from './PokerChatDock';
import { PokerCommunityBoard } from './PokerCommunityBoard';
import { PokerPotArea } from './PokerPotArea';
import { PokerSeatRing } from './PokerSeatRing';
import { PokerTableLayout } from './PokerTableLayout';
import type {
  PokerActionAvailability,
  PokerChatMessage,
  PokerPlayerAction,
  PokerTableViewModel,
} from '../state/pokerTypes';
import '../styles/poker-table.css';

export interface PokerTableShellProps {
  viewModel: PokerTableViewModel;
  actionAvailability?: PokerActionAvailability;
  chatMessages?: PokerChatMessage[];
  unreadCount?: number;
  chatSending?: boolean;
  disabled?: boolean;
  readOnlyChat?: boolean;
  canEditBlinds?: boolean;
  tableId?: string;
  onAction?: (action: PokerPlayerAction, amount?: number) => void;
  onSendChat?: (message: string) => void;
  onSaveBlinds?: (smallBlind: number, bigBlind: number) => void;
}

export function PokerTableShell({
  viewModel,
  actionAvailability,
  chatMessages = [],
  unreadCount = 0,
  chatSending = false,
  disabled = false,
  readOnlyChat = false,
  canEditBlinds = false,
  tableId,
  onAction,
  onSendChat,
  onSaveBlinds,
}: PokerTableShellProps) {
  const activeSeat = viewModel.seats.find((seat) => seat.playerId === viewModel.activePlayerId);
  const activePlayerName = activeSeat?.displayName ?? null;
  const availability = actionAvailability ?? {
    canCheck: false,
    canCall: false,
    canBet: false,
    canRaise: false,
    canFold: false,
    canAllIn: false,
    callAmount: 0,
    allInAmount: 0,
    minBet: viewModel.bigBlind,
    minRaise: viewModel.bigBlind,
  };

  return (
    <section
      className="poker-table-shell"
      data-game="poker"
      data-table-id={tableId}
      aria-label={viewModel.tableName}
    >
      <PokerTableLayout
        toolbar={
          <header className="poker-table-shell__toolbar">
            <div>
              <h2 className="poker-table-shell__title">{viewModel.tableName}</h2>
              <p className="poker-table-shell__subtitle">
                Blinds {viewModel.smallBlind}/{viewModel.bigBlind} · virtual chips only
              </p>
            </div>
            <PokerBlindsControl
              smallBlind={viewModel.smallBlind}
              bigBlind={viewModel.bigBlind}
              editable={canEditBlinds}
              onSave={onSaveBlinds}
            />
            {viewModel.resultSummary && (
              <p className="poker-table-shell__result">{viewModel.resultSummary}</p>
            )}
          </header>
        }
        seatRing={<PokerSeatRing seats={viewModel.seats} />}
        potArea={
          <PokerPotArea
            pot={viewModel.pot}
            currentBet={viewModel.currentBet}
            smallBlind={viewModel.smallBlind}
            bigBlind={viewModel.bigBlind}
            sidePotCount={viewModel.sidePotCount}
            payoutSummary={viewModel.payoutSummary}
            winningHandLabel={viewModel.winningHandLabel}
          />
        }
        communityBoard={
          <PokerCommunityBoard street={viewModel.street} communityCards={viewModel.communityCards} />
        }
        actionPanel={
          <PokerActionPanel
            activePlayerName={activePlayerName}
            availability={availability}
            disabled={disabled}
            onAction={onAction}
          />
        }
        chatDock={
          <PokerChatDock
            messages={chatMessages}
            actionLog={viewModel.actionLog}
            readOnly={readOnlyChat}
            unreadCount={unreadCount}
            sending={chatSending}
            onSendMessage={onSendChat}
          />
        }
      />
    </section>
  );
}
