import { useState } from 'react';
import { resolveTableClothWager } from '../../../types/tableFeltSkin';
import type { GameState } from '../../../types';
import { POKER_TEMPLATE_SHELL, POKER_HR_SHELL_ALIAS } from '../pokerTemplateContract';
import { PokerActionPanel } from './PokerActionPanel';
import { PokerCommunityBoard } from './PokerCommunityBoard';
import { PokerFeltClothLayer } from './PokerFeltClothLayer';
import { PokerSeatRing } from './PokerSeatRing';
import { PokerShowdownCopy } from './PokerShowdownCopy';
import { PokerTableHeader } from './PokerTableHeader';
import { PokerTableLayout } from './PokerTableLayout';
import { PokerTablePanel } from './PokerTablePanel';
import type {
  PokerActionAvailability,
  PokerChatMessage,
  PokerPlayerAction,
  PokerTableViewModel,
} from '../state/pokerTypes';
import type { TableResetSetupVariant } from '../../../components/TableStakePanel';
import '../styles/poker-table.css';

export interface PokerTableShellProps {
  gameState: GameState;
  viewModel: PokerTableViewModel;
  actionAvailability?: PokerActionAvailability;
  chatMessages?: PokerChatMessage[];
  chatSending?: boolean;
  disabled?: boolean;
  tableId?: string;
  statusHint?: string;
  startHandBlockReason?: string | null;
  waitingForPlayerName?: string | null;
  canActOnTurn?: boolean;
  handActive?: boolean;
  handResolved?: boolean;
  challengeEnded?: boolean;
  needsShuffle?: boolean;
  canStartHand?: boolean;
  canEditBlinds?: boolean;
  canAddChips?: boolean;
  canResetTable?: boolean;
  isPractice?: boolean;
  isChallenge?: boolean;
  showInvite?: boolean;
  showEndChallenge?: boolean;
  startHandLabel?: string;
  onAction?: (action: PokerPlayerAction, amount?: number) => void;
  onSendChat?: (message: string) => void;
  onSaveBlinds?: (smallBlind: number, bigBlind: number) => void;
  onInviteTable?: () => void;
  onLeaveTable?: () => void;
  onEndChallenge?: () => void;
  onStartHand?: () => void;
  onShuffleDeck?: () => void;
  onBeginTableReset?: (variant?: TableResetSetupVariant) => void;
  onAddChips?: (playerId: string, amount: number) => void;
}

export function PokerTableShell({
  gameState: _gameState,
  viewModel,
  actionAvailability,
  chatMessages = [],
  chatSending = false,
  disabled = false,
  tableId,
  statusHint,
  startHandBlockReason = null,
  waitingForPlayerName = null,
  canActOnTurn = false,
  handActive = false,
  handResolved = false,
  challengeEnded = false,
  needsShuffle = false,
  canStartHand = false,
  canEditBlinds = false,
  canAddChips = false,
  canResetTable = false,
  isPractice = false,
  isChallenge = false,
  showInvite = false,
  showEndChallenge = false,
  startHandLabel = 'Deal Cards',
  onAction,
  onSendChat,
  onSaveBlinds,
  onInviteTable,
  onLeaveTable,
  onEndChallenge,
  onStartHand,
  onShuffleDeck,
  onBeginTableReset,
  onAddChips,
}: PokerTableShellProps) {
  const [tablePanelOpen, setTablePanelOpen] = useState(false);
  const activeSeat = viewModel.seats.find((seat) => seat.playerId === viewModel.activePlayerId);
  const actingName = canActOnTurn ? activeSeat?.displayName ?? null : null;
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

  const showHeaderDeal =
    canStartHand && !challengeEnded && (!handActive || handResolved) && Boolean(onStartHand);
  const startDisabled = Boolean(startHandBlockReason);
  const dealLabel = handResolved ? 'Deal next hand' : startHandLabel;
  const wagerRaw = resolveTableClothWager(_gameState.tableMeta);
  const playingForText = wagerRaw ? `Playing for ${wagerRaw}` : undefined;

  return (
    <section
      className={`poker-table-shell ${POKER_TEMPLATE_SHELL} ${POKER_HR_SHELL_ALIAS}`}
      data-game="poker"
      data-table-id={tableId}
      data-template="poker0"
      aria-label={viewModel.tableName}
    >
      <PokerTableLayout
        topBar={
          <PokerTableHeader
            tableName={viewModel.tableName}
            playingForText={playingForText}
            smallBlind={viewModel.smallBlind}
            bigBlind={viewModel.bigBlind}
            pot={viewModel.pot}
            statusHint={statusHint}
            startHandBlockReason={startHandBlockReason}
            dealLabel={dealLabel}
            showDeal={showHeaderDeal}
            dealDisabled={startDisabled}
            tablePanelOpen={tablePanelOpen}
            onToggleTablePanel={() => setTablePanelOpen((open) => !open)}
            onStartHand={onStartHand}
          />
        }
        feltCloth={<PokerFeltClothLayer tableName={viewModel.tableName} />}
        seatRing={<PokerSeatRing seats={viewModel.seats} />}
        communityBoard={
          <PokerCommunityBoard
            street={viewModel.street}
            communityCards={viewModel.communityCards}
            handActive={handActive}
          />
        }
        feltShowdown={
          <PokerShowdownCopy
            winningHandLabel={viewModel.winningHandLabel}
            payoutSummary={viewModel.payoutSummary}
            sidePotCount={viewModel.sidePotCount}
          />
        }
        actionPanel={
          <PokerActionPanel
            activePlayerName={actingName}
            waitingForPlayerName={waitingForPlayerName}
            availability={availability}
            pot={viewModel.pot}
            bigBlind={viewModel.bigBlind}
            disabled={disabled || !handActive || !canActOnTurn}
            onAction={onAction}
          />
        }
      />

      <PokerTablePanel
        open={tablePanelOpen}
        onClose={() => setTablePanelOpen(false)}
        seats={viewModel.seats}
        isPractice={isPractice}
        isChallenge={isChallenge}
        canEditBlinds={canEditBlinds}
        canAddChips={canAddChips}
        canResetTable={canResetTable}
        showInvite={showInvite}
        showEndChallenge={showEndChallenge}
        showStartHand={showHeaderDeal}
        showShuffleDeck={needsShuffle && Boolean(onShuffleDeck)}
        startHandLabel={dealLabel}
        smallBlind={viewModel.smallBlind}
        bigBlind={viewModel.bigBlind}
        chatMessages={chatMessages}
        actionLog={viewModel.actionLog}
        chatSending={chatSending}
        onSendChat={onSendChat}
        onSaveBlinds={onSaveBlinds}
        onInviteTable={onInviteTable}
        onLeaveTable={onLeaveTable}
        onEndChallenge={onEndChallenge}
        onStartHand={onStartHand}
        onShuffleDeck={onShuffleDeck}
        onBeginTableReset={onBeginTableReset}
        onAddChips={onAddChips}
      />
    </section>
  );
}
