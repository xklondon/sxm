import { randomUUID } from 'node:crypto';

export interface TableChatMessageRecord {
  id: string;
  tableId: string;
  senderEmail: string;
  senderName?: string;
  body: string;
  createdAt: string;
  type: 'user' | 'system';
}

const MAX_MESSAGES_PER_TABLE = 200;
const MAX_BODY_LENGTH = 500;

const messagesByTable = new Map<string, TableChatMessageRecord[]>();

export function listTableChatMessages(tableId: string): TableChatMessageRecord[] {
  return [...(messagesByTable.get(tableId) ?? [])];
}

export function addTableChatMessage(input: {
  tableId: string;
  senderEmail: string;
  senderName?: string;
  body: string;
  type?: TableChatMessageRecord['type'];
}): TableChatMessageRecord {
  const body = input.body.trim();
  if (!body) {
    throw new Error('Message body cannot be empty');
  }
  if (body.length > MAX_BODY_LENGTH) {
    throw new Error(`Message body cannot exceed ${MAX_BODY_LENGTH} characters`);
  }

  const message: TableChatMessageRecord = {
    id: randomUUID(),
    tableId: input.tableId,
    senderEmail: input.senderEmail.trim().toLowerCase() || 'guest@local',
    senderName: input.senderName?.trim() || undefined,
    body,
    createdAt: new Date().toISOString(),
    type: input.type ?? 'user',
  };

  const existing = messagesByTable.get(input.tableId) ?? [];
  const next = [...existing, message];
  if (next.length > MAX_MESSAGES_PER_TABLE) {
    messagesByTable.set(input.tableId, next.slice(next.length - MAX_MESSAGES_PER_TABLE));
  } else {
    messagesByTable.set(input.tableId, next);
  }

  return message;
}

export function clearTableChatMessages(tableId: string): void {
  messagesByTable.delete(tableId);
}

/** Test helper */
export function resetTableChatStore(): void {
  messagesByTable.clear();
}
