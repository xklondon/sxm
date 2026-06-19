import { describe, expect, it } from 'vitest';
import {
  countUnreadTableChatMessages,
  latestTableChatMessageTimestamp,
  type TableChatMessage,
} from './tableMessagingTypes';

function message(
  id: string,
  senderEmail: string,
  createdAt: string,
): TableChatMessage {
  return {
    id,
    tableId: 'table-1',
    senderEmail,
    body: 'hello',
    createdAt,
    type: 'user',
  };
}

describe('table chat unread', () => {
  const me = 'alice@example.com';
  const lastSeenAt = '2026-06-19T12:00:00.000Z';

  it('does not count own messages as unread', () => {
    const messages = [message('m1', me, '2026-06-19T12:00:05.000Z')];
    expect(countUnreadTableChatMessages(messages, lastSeenAt, me)).toBe(0);
  });

  it('counts other user messages when closed and newer than lastSeenAt', () => {
    const messages = [
      message('m1', 'bob@example.com', '2026-06-19T12:00:05.000Z'),
      message('m2', 'carol@example.com', '2026-06-19T12:00:10.000Z'),
    ];
    expect(countUnreadTableChatMessages(messages, lastSeenAt, me)).toBe(2);
  });

  it('clears unread when lastSeenAt catches up to latest message', () => {
    const messages = [message('m1', 'bob@example.com', '2026-06-19T12:00:05.000Z')];
    expect(countUnreadTableChatMessages(messages, '2026-06-19T12:00:05.000Z', me)).toBe(0);
    expect(countUnreadTableChatMessages(messages, '2026-06-19T12:00:06.000Z', me)).toBe(0);
  });

  it('does not show old messages as unread when lastSeenAt is null', () => {
    const messages = [message('m1', 'bob@example.com', '2026-06-19T11:00:00.000Z')];
    expect(countUnreadTableChatMessages(messages, null, me)).toBe(0);
  });

  it('latestTableChatMessageTimestamp returns newest message time', () => {
    const messages = [
      message('m1', me, '2026-06-19T12:00:01.000Z'),
      message('m2', 'bob@example.com', '2026-06-19T12:00:02.000Z'),
    ];
    expect(latestTableChatMessageTimestamp(messages)).toBe('2026-06-19T12:00:02.000Z');
  });
});
