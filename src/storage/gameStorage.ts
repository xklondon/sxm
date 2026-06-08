import type { GameState } from '../types';
import type { InviteStatus, TableInviteRecord } from '../types/invites';
import type { Player } from '../types/player';
import { log } from '../utils/logger';
import { DEFAULT_BLACKJACK_PROTOCOL_ID } from '../engine/blackjack/protocols';
import { DEFAULT_DESIGN_TEMPLATE_ID } from '../design/templates';
import { validateBlackjackTableThemeOverrides } from '../design/blackjackTableTheme';
import { DEFAULT_TABLE_ADMIN_SETTINGS } from '../types/admin';
import { normalizeFlowSettings } from '../engine/blackjack/flowSettings';
import { DEFAULT_ZILCH_SETTINGS } from '../engine/zilch/settings';
import { normalizeLoadedGameState } from '../engine/session/tableKind';
import { DEFAULT_TABLE_CLOTH_NAME, DEFAULT_TABLE_FELT_SKIN, isTableFeltSkin } from '../types/tableFeltSkin';

const CURRENT_GAME_KEY = 'sxmcards:current-game:v1';
const SAVED_GAMES_KEY = 'sxmcards:saved-games:v1';

export interface SavedGameMeta {
  id: string;
  savedAt: string;
  label: string;
}

export interface SavedGameRecord {
  meta: SavedGameMeta;
  state: GameState;
}

export function serializeGameState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeGameState(raw: string): GameState {
  const parsed = JSON.parse(raw) as GameState;
  if (!parsed?.session?.id || !parsed.ledger) {
    throw new Error('Invalid saved game data');
  }
  const merged: GameState = {
    ...parsed,
    tableMeta: {
      ...parsed.tableMeta,
      gameCategory: parsed.tableMeta?.gameCategory,
      diceGame: parsed.tableMeta?.diceGame,
      owner: parsed.tableMeta.owner ?? null,
      ownerPersonId: parsed.tableMeta.ownerPersonId ?? null,
      playerOrder: parsed.tableMeta.playerOrder ?? [],
      assignedBoxByPersonId: parsed.tableMeta.assignedBoxByPersonId ?? {},
      protocolLocked: parsed.tableMeta.protocolLocked ?? false,
      invites: (parsed.tableMeta.invites ?? []).map((inv: Partial<TableInviteRecord> & { id?: string; email?: string; name?: string; status?: string; invitedAt?: string }) => ({
        inviteId: inv.inviteId ?? (inv as { id?: string }).id ?? '',
        tableId: inv.tableId ?? parsed.session.id,
        invitedEmail: inv.invitedEmail ?? (inv as { email?: string }).email ?? '',
        invitedName: inv.invitedName ?? (inv as { name?: string }).name ?? '',
        invitedBy: inv.invitedBy ?? '',
        inviteStatus: (inv.inviteStatus ?? (inv as { status?: string }).status ?? 'pending') as InviteStatus,
        canInviteOthers: inv.canInviteOthers ?? false,
        createdAt: inv.createdAt ?? (inv as { invitedAt?: string }).invitedAt ?? new Date().toISOString(),
        token: inv.token ?? '',
        note: inv.note,
      })),
      boxStakes: parsed.tableMeta.boxStakes ?? {},
      bettingLocked: parsed.tableMeta.bettingLocked ?? false,
      shoeStarted: parsed.tableMeta.shoeStarted ?? false,
      startingChipsEachSeat:
        parsed.tableMeta.startingChipsEachSeat ??
        parsed.tableMeta.agreement?.defaultChips ??
        500,
      startingChipsBank:
        parsed.tableMeta.startingChipsBank ??
        parsed.tableMeta.startingChipsEachSeat ??
        parsed.tableMeta.agreement?.defaultChips ??
        500,
      minimumBet:
        parsed.tableMeta.minimumBet ??
        parsed.blackjackSettings?.minBet ??
        5,
      awaitingNextRound: parsed.tableMeta.awaitingNextRound ?? false,
      showRoundSummaryOverlay: parsed.tableMeta.showRoundSummaryOverlay ?? true,
      tableFeltSkin: isTableFeltSkin(parsed.tableMeta?.tableFeltSkin)
        ? parsed.tableMeta.tableFeltSkin
        : DEFAULT_TABLE_FELT_SKIN,
      tableClothName:
        typeof parsed.tableMeta?.tableClothName === 'string'
          ? parsed.tableMeta.tableClothName
          : DEFAULT_TABLE_CLOTH_NAME,
      tableClothWager:
        typeof parsed.tableMeta?.tableClothWager === 'string' ? parsed.tableMeta.tableClothWager : '',
      gameStatus: parsed.tableMeta.gameStatus ?? 'active',
      winnerId: parsed.tableMeta.winnerId ?? null,
      endedAt: parsed.tableMeta.endedAt ?? null,
      wagerVoucherStatus: parsed.tableMeta.wagerVoucherStatus ?? 'not-created',
      boxSlots: (parsed.tableMeta.boxSlots ?? []).map((s: {
        bankrollOwnerId?: string | null;
        nativeAssignedPersonId?: string | null;
        callerPersonId?: string | null;
        slotNumber: number;
        playerId: string | null;
        passiveNames: string[];
      }) => ({
        ...s,
        bankrollOwnerId: s.bankrollOwnerId ?? null,
        nativeAssignedPersonId: s.nativeAssignedPersonId ?? null,
        callerPersonId: s.callerPersonId ?? null,
      })),
    },
    players: Object.fromEntries(
      Object.entries(parsed.players ?? {}).map(([id, p]) => [
        id,
        {
          ...(p as Player),
          role: (p as Player).role ?? (parsed.session?.boxSlotNumbers?.[id] ? 'box' : id === parsed.session?.bankPlayerId ? 'bank' : 'person'),
        },
      ]),
    ),
    blackjackProtocolId: parsed.blackjackProtocolId ?? DEFAULT_BLACKJACK_PROTOCOL_ID,
    designTemplateId: parsed.designTemplateId ?? DEFAULT_DESIGN_TEMPLATE_ID,
    blackjackTableTheme: validateBlackjackTableThemeOverrides(parsed.blackjackTableTheme),
    tableAdminSettings: parsed.tableAdminSettings ?? { ...DEFAULT_TABLE_ADMIN_SETTINGS },
    blackjackFlowSettings: normalizeFlowSettings(parsed.blackjackFlowSettings),
    zilch: parsed.zilch ?? null,
    zilchSettings: parsed.zilchSettings ?? { ...DEFAULT_ZILCH_SETTINGS },
  };
  return normalizeLoadedGameState(merged);
}

export function saveCurrentGame(state: GameState): void {
  try {
    localStorage.setItem(CURRENT_GAME_KEY, serializeGameState(state));
    log.info('Game saved', { sessionId: state.session.id });
  } catch (err) {
    log.warn('Failed to save game', { err });
    throw new Error('Could not save game — storage may be full.');
  }
}

export function loadCurrentGame(): GameState | null {
  try {
    const raw = localStorage.getItem(CURRENT_GAME_KEY);
    if (!raw) {
      return null;
    }
    return deserializeGameState(raw);
  } catch (err) {
    log.warn('Failed to load saved game', { err });
    return null;
  }
}

export function clearSavedGame(): void {
  localStorage.removeItem(CURRENT_GAME_KEY);
  log.info('Saved game cleared');
}

export function listSavedGames(): SavedGameMeta[] {
  try {
    const raw = localStorage.getItem(SAVED_GAMES_KEY);
    if (!raw) {
      return [];
    }
    const records = JSON.parse(raw) as SavedGameRecord[];
    return records.map((r) => r.meta);
  } catch {
    return [];
  }
}

/** Optional archive slot — keeps last few named saves. */
export function archiveGame(state: GameState, label?: string): void {
  const record: SavedGameRecord = {
    meta: {
      id: state.session.id,
      savedAt: new Date().toISOString(),
      label: label ?? `Table ${state.session.id.slice(0, 6)}`,
    },
    state,
  };
  try {
    const raw = localStorage.getItem(SAVED_GAMES_KEY);
    const list: SavedGameRecord[] = raw ? (JSON.parse(raw) as SavedGameRecord[]) : [];
    const next = [record, ...list.filter((r) => r.meta.id !== record.meta.id)].slice(0, 5);
    localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(next));
  } catch (err) {
    log.warn('Failed to archive game', { err });
  }
}
