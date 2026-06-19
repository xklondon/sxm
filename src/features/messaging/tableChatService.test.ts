import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mergeTableMessagesById,
  validateTableChatBody,
  type TableChatMessage,
} from './tableMessagingTypes';
import { addTableMessage, clearTableMessages, getTableMessages } from './tableChatService';

const STORAGE_KEY = 'sxmcards:table-chat:v1';

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('table chat validation', () => {
  it('validateTableChatBody rejects empty body', () => {
    expect(() => validateTableChatBody('   ')).toThrow(/empty/i);
  });

  it('validateTableChatBody trims text', () => {
    expect(validateTableChatBody('  hello table  ')).toBe('hello table');
  });

  it('mergeTableMessagesById deduplicates by id', () => {
    const first: TableChatMessage = {
      id: 'm1',
      tableId: 'table-a',
      senderEmail: 'a@example.com',
      body: 'first',
      createdAt: '2026-06-19T10:00:00.000Z',
      type: 'user',
    };
    const updated: TableChatMessage = {
      ...first,
      body: 'updated',
    };
    const second: TableChatMessage = {
      id: 'm2',
      tableId: 'table-a',
      senderEmail: 'b@example.com',
      body: 'second',
      createdAt: '2026-06-19T10:01:00.000Z',
      type: 'user',
    };
    const merged = mergeTableMessagesById([first], [updated, second]);
    expect(merged).toHaveLength(2);
    expect(merged.find((message) => message.id === 'm1')?.body).toBe('updated');
  });
});

describe('tableChatService local fallback', () => {
  beforeEach(() => {
    (globalThis as { localStorage: Storage }).localStorage = createLocalStorageMock();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })) as typeof fetch);
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    vi.unstubAllGlobals();
  });

  it('falls back to local storage when server fetch fails', async () => {
    await addTableMessage(
      {
        tableId: 'table-a',
        senderEmail: 'host@example.com',
        body: 'offline hello',
      },
      { preferServer: true },
    );

    const messages = await getTableMessages('table-a', { preferServer: true });
    expect(messages.map((message) => message.body)).toEqual(['offline hello']);

    clearTableMessages('table-a');
    expect(await getTableMessages('table-a', { preferServer: true })).toEqual([]);
  });
});
