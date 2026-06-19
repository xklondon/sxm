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

export function formatInviteHostMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return '';
  }
  return `Message from host:\n${trimmed}`;
}
