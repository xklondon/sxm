import { useCallback, useEffect, useMemo, useState } from 'react';
import { addTableMessage, getTableMessages } from '../../../features/messaging/tableChatService';
import {
  countUnreadTableChatMessages,
  latestTableChatMessageTimestamp,
  mergeTableMessagesById,
  readTableChatLastSeenAt,
  writeTableChatLastSeenAt,
  type TableChatMessage,
} from '../../../features/messaging/tableMessagingTypes';
import type { PokerChatMessage } from '../state/pokerTypes';

const OPEN_POLL_MS = 2000;
const CLOSED_POLL_MS = 5000;

function mapTableChatMessage(message: TableChatMessage): PokerChatMessage {
  return {
    id: message.id,
    author: message.senderName?.trim() || message.senderEmail.split('@')[0] || 'Guest',
    body: message.body,
    timestamp: Date.parse(message.createdAt) || Date.now(),
  };
}

export interface UsePokerTableChatOptions {
  tableId: string;
  currentUserEmail?: string | null;
  currentUserName?: string | null;
  preferServer?: boolean;
  open?: boolean;
}

export function usePokerTableChat({
  tableId,
  currentUserEmail,
  currentUserName,
  preferServer = false,
  open = true,
}: UsePokerTableChatOptions) {
  const [messages, setMessages] = useState<TableChatMessage[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(() =>
    tableId ? readTableChatLastSeenAt(tableId, currentUserEmail ?? 'guest@local') : null,
  );
  const [sending, setSending] = useState(false);
  const normalizedEmail = (currentUserEmail ?? 'guest@local').trim().toLowerCase() || 'guest@local';
  const displayName = currentUserName?.trim() || 'Guest';

  const pokerMessages = useMemo(
    () => messages.map(mapTableChatMessage),
    [messages],
  );

  const unreadCount = useMemo(() => {
    if (open) {
      return 0;
    }
    return countUnreadTableChatMessages(messages, lastSeenAt, normalizedEmail);
  }, [open, messages, lastSeenAt, normalizedEmail]);

  const refreshMessages = useCallback(async () => {
    if (!tableId) {
      return;
    }
    const fetched = await getTableMessages(tableId, { preferServer });
    setMessages((current) => mergeTableMessagesById(current, fetched));
  }, [tableId, preferServer]);

  const markSeen = useCallback(
    (messageList: TableChatMessage[]) => {
      if (!tableId || !open) {
        return;
      }
      const seenAt = latestTableChatMessageTimestamp(messageList) ?? new Date().toISOString();
      writeTableChatLastSeenAt(tableId, normalizedEmail, seenAt);
      setLastSeenAt(seenAt);
    },
    [tableId, normalizedEmail, open],
  );

  useEffect(() => {
    if (!tableId) {
      return;
    }
    setLastSeenAt(readTableChatLastSeenAt(tableId, normalizedEmail));
  }, [tableId, normalizedEmail]);

  useEffect(() => {
    if (!tableId) {
      return;
    }
    void refreshMessages();
    const interval = window.setInterval(() => void refreshMessages(), open ? OPEN_POLL_MS : CLOSED_POLL_MS);
    return () => window.clearInterval(interval);
  }, [tableId, open, refreshMessages]);

  useEffect(() => {
    if (open) {
      markSeen(messages);
    }
  }, [open, messages, markSeen]);

  const sendMessage = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed || !tableId || sending) {
        return;
      }
      setSending(true);
      try {
        await addTableMessage(
          {
            tableId,
            senderEmail: normalizedEmail,
            senderName: displayName,
            body: trimmed,
          },
          { preferServer },
        );
        await refreshMessages();
      } finally {
        setSending(false);
      }
    },
    [tableId, normalizedEmail, displayName, preferServer, refreshMessages, sending],
  );

  return {
    messages: pokerMessages,
    unreadCount,
    sending,
    sendMessage,
    refreshMessages,
  };
}
