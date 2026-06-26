import { useState } from 'react';
import { resolveTableClothWager } from '../../../types/tableFeltSkin';
import type { GameState } from '../../../types';
import {
  POKER_TEMPLATE_DEAL_BTN,
  POKER_TEMPLATE_SHELL,
  POKER_TEMPLATE_TOPBAR,
} from '../pokerTemplateContract';
import { PokerActionPanel } from './PokerActionPanel';
import { PokerCommunityBoard } from './PokerCommunityBoard';
import { PokerFeltClothLayer } from './PokerFeltClothLayer';
import { PokerPotArea } from './PokerPotArea';
import { PokerSeatRing } from './PokerSeatRing';
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
  gameState,
  viewModel,
  actionAvailability,
  chatMessages = [],
  chatSending = false,
  disabled = false,
  tableId,
  statusHint,
  startHandBlockReason = null,
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

  const showFeltDeal =
    canStartHand && !challengeEnded && (!handActive || handResolved) && Boolean(onStartHand);
  const startDisabled = Boolean(startHandBlockReason);
  const topBarStatus =
    !handActive && startHandBlockReason
      ? startHandBlockReason
      : statusHint ?? 'Virtual chips only';
  const blindsText = `Blinds ${viewModel.smallBlind}/${viewModel.bigBlind}`;
  const wagerText = resolveTableClothWager(gameState.tableMeta);
  const dealLabel = handResolved ? 'Deal next hand' : startHandLabel;

  return (
    <section
      className={`poker-table-shell ${POKER_TEMPLATE_SHELL}`}
      data-game="poker"
      data-table-id={tableId}
      data-template="high-roller-protocol"
      aria-label={viewModel.tableName}
    >
      <PokerTableLayout
        topBar={
          <header className={`poker-table-shell__topbar ${POKER_TEMPLATE_TOPBAR}`}>
            <p className="poker-hr-topbar__status">{topBarStatus}</p>
            <button
              type="button"
              className={`poker-table-shell__this-table poker-hr-topbar__menu${tablePanelOpen ? ' poker-table-shell__this-table--active' : ''}`}
              aria-expanded={tablePanelOpen}
              onClick={() => setTablePanelOpen((open) => !open)}
            >
              This Table
            </button>
          </header>
        }
        feltHeader={
          <PokerFeltClothLayer
            tableName={viewModel.tableName}
            wagerText={wagerText ? `Playing for ${wagerText}` : undefined}
            blindsText={blindsText}
          />
        }
        feltCenterOverlay={
          showFeltDeal ? (
            <div className="poker-hr-deal">
              <button
                type="button"
                className={`poker-felt__start-btn ${POKER_TEMPLATE_DEAL_BTN}`}
                disabled={startDisabled}
                onClick={onStartHand}
              >
                {dealLabel}
              </button>
            </div>
          ) : null
        }
        seatRing={<PokerSeatRing seats={viewModel.seats} />}
        potArea={
          <PokerPotArea
            pot={viewModel.pot}
            currentBet={viewModel.currentBet}
            sidePotCount={viewModel.sidePotCount}
            payoutSummary={viewModel.payoutSummary}
            winningHandLabel={viewModel.winningHandLabel}
          />
        }
        communityBoard={
          <PokerCommunityBoard
            street={viewModel.street}
            communityCards={viewModel.communityCards}
            handActive={handActive}
          />
        }
        actionPanel={
          <PokerActionPanel
            activePlayerName={activePlayerName}
            availability={availability}
            pot={viewModel.pot}
            bigBlind={viewModel.bigBlind}
            disabled={disabled || !handActive}
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
        showStartHand={showFeltDeal}
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
