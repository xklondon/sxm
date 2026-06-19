import { apiPath } from '../../api/config';
import {
  createTableMessageId,
  validateTableChatBody,
  type TableChatMessage,
} from './tableMessagingTypes';

const STORAGE_KEY = 'sxmcards:table-chat:v1';

type ChatStore = Record<string, TableChatMessage[]>;

export interface TableChatServiceOptions {
  /** When true, load/send via server API first. */
  preferServer?: boolean;
}

function readLocalStore(): ChatStore {
  if (typeof localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as ChatStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalStore(store: ChatStore): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function readLocalMessages(tableId: string): TableChatMessage[] {
  const store = readLocalStore();
  return [...(store[tableId] ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function writeLocalMessage(tableId: string, message: TableChatMessage): void {
  const store = readLocalStore();
  const existing = store[tableId] ?? [];
  store[tableId] = [...existing, message];
  writeLocalStore(store);
}

async function fetchServerMessages(tableId: string): Promise<TableChatMessage[]> {
  const res = await fetch(apiPath(`/api/tables/${encodeURIComponent(tableId)}/messages`), {
    credentials: 'include',
  });
  const data = (await res.json()) as { messages?: TableChatMessage[]; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Could not load table messages');
  }
  return [...(data.messages ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function postServerMessage(
  tableId: string,
  input: {
    senderEmail: string;
    senderName?: string;
    body: string;
  },
): Promise<TableChatMessage> {
  const res = await fetch(apiPath(`/api/tables/${encodeURIComponent(tableId)}/messages`), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      senderEmail: input.senderEmail,
      senderName: input.senderName,
      body: input.body,
    }),
  });
  const data = (await res.json()) as { message?: TableChatMessage; error?: string };
  if (!res.ok || !data.message) {
    throw new Error(data.error ?? 'Could not send table message');
  }
  return data.message;
}

export async function getTableMessages(
  tableId: string,
  options?: TableChatServiceOptions,
): Promise<TableChatMessage[]> {
  if (options?.preferServer) {
    try {
      return await fetchServerMessages(tableId);
    } catch {
      return readLocalMessages(tableId);
    }
  }
  return readLocalMessages(tableId);
}

export async function addTableMessage(
  input: {
    tableId: string;
    senderEmail: string;
    senderName?: string;
    body: string;
    type?: TableChatMessage['type'];
  },
  options?: TableChatServiceOptions,
): Promise<TableChatMessage> {
  const body = validateTableChatBody(input.body);

  if (options?.preferServer) {
    try {
      return await postServerMessage(input.tableId, {
        senderEmail: input.senderEmail,
        senderName: input.senderName,
        body,
      });
    } catch {
      // Fall back to local-only chat when the API is unavailable.
    }
  }

  const message: TableChatMessage = {
    id: createTableMessageId(),
    tableId: input.tableId,
    senderEmail: input.senderEmail.trim().toLowerCase() || 'guest@local',
    senderName: input.senderName?.trim() || undefined,
    body,
    createdAt: new Date().toISOString(),
    type: input.type ?? 'user',
  };

  writeLocalMessage(input.tableId, message);
  return message;
}

export function clearTableMessages(tableId: string): void {
  const store = readLocalStore();
  delete store[tableId];
  writeLocalStore(store);
}
