import { generateId } from '../../engine/utils/id';

export interface TableInviteMessage {
  playerEmail: string;
  message: string;
}

export interface TableChatMessage {
  id: string;
  tableId: string;
  senderEmail: string;
  senderName?: string;
  body: string;
  createdAt: string;
  type: 'user' | 'system';
}

export interface InvitedTablePlayerSetup {
  email: string;
  inviteMessage?: string;
}

export function createTableMessageId(): string {
  return generateId();
}

export const TABLE_CHAT_MAX_BODY_LENGTH = 500;

export function validateTableChatBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error('Message body cannot be empty');
  }
  if (trimmed.length > TABLE_CHAT_MAX_BODY_LENGTH) {
    throw new Error(`Message body cannot exceed ${TABLE_CHAT_MAX_BODY_LENGTH} characters`);
  }
  return trimmed;
}

export function mergeTableMessagesById(
  current: TableChatMessage[],
  incoming: TableChatMessage[],
): TableChatMessage[] {
  const byId = new Map<string, TableChatMessage>();
  for (const message of [...current, ...incoming]) {
    byId.set(message.id, message);
  }
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function tableChatLastSeenStorageKey(tableId: string, userEmail: string): string {
  const normalizedEmail = userEmail.trim().toLowerCase() || 'guest@local';
  return `sxm:table-chat:last-seen:${tableId}:${normalizedEmail}`;
}

export function readTableChatLastSeenAt(tableId: string, userEmail: string): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(tableChatLastSeenStorageKey(tableId, userEmail));
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export function writeTableChatLastSeenAt(tableId: string, userEmail: string, lastSeenAt: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(tableChatLastSeenStorageKey(tableId, userEmail), lastSeenAt);
  } catch {
    // Ignore quota / privacy mode errors.
  }
}

export function latestTableChatMessageTimestamp(messages: TableChatMessage[]): string | null {
  if (messages.length === 0) {
    return null;
  }
  return messages[messages.length - 1]!.createdAt;
}

export function countUnreadTableChatMessages(
  messages: TableChatMessage[],
  lastSeenAt: string | null,
  currentUserEmail: string,
): number {
  if (!lastSeenAt) {
    return 0;
  }
  const normalizedSelf = currentUserEmail.trim().toLowerCase() || 'guest@local';
  return messages.filter((message) => {
    if (message.senderEmail.trim().toLowerCase() === normalizedSelf) {
      return false;
    }
    return message.createdAt > lastSeenAt;
  }).length;
}

export function formatInviteHostMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return '';
  }
  return `Message from host:\n${trimmed}`;
}
