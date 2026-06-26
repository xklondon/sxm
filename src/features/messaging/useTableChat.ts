import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addTableMessage, getTableMessages } from './tableChatService';
import {
  countUnreadTableChatMessages,
  latestTableChatMessageTimestamp,
  mergeTableMessagesById,
  readTableChatLastSeenAt,
  writeTableChatLastSeenAt,
  type TableChatMessage,
} from './tableMessagingTypes';

const OPEN_POLL_MS = 2000;
const CLOSED_POLL_MS = 5000;

export interface UseTableChatOptions {
  tableId: string;
  currentUserEmail?: string | null;
  currentUserName?: string | null;
  preferServer?: boolean;
  /** When true, polls faster and clears unread counts (embedded dock). */
  open?: boolean;
}

export function useTableChat({
  tableId,
  currentUserEmail,
  currentUserName,
  preferServer = false,
  open = false,
}: UseTableChatOptions) {
  const [messages, setMessages] = useState<TableChatMessage[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(() =>
    tableId ? readTableChatLastSeenAt(tableId, currentUserEmail ?? 'guest@local') : null,
  );
  const [sending, setSending] = useState(false);
  const bootstrapDoneRef = useRef(false);
  const normalizedEmail = (currentUserEmail ?? 'guest@local').trim().toLowerCase() || 'guest@local';
  const displayName = currentUserName?.trim() || 'Guest';

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
    bootstrapDoneRef.current = false;
    setLastSeenAt(readTableChatLastSeenAt(tableId, normalizedEmail));
  }, [tableId, normalizedEmail]);

  useEffect(() => {
    if (!tableId || bootstrapDoneRef.current) {
      return;
    }
    const stored = readTableChatLastSeenAt(tableId, normalizedEmail);
    if (stored) {
      setLastSeenAt(stored);
      bootstrapDoneRef.current = true;
      return;
    }
    const bootstrapAt = latestTableChatMessageTimestamp(messages) ?? new Date().toISOString();
    writeTableChatLastSeenAt(tableId, normalizedEmail, bootstrapAt);
    setLastSeenAt(bootstrapAt);
    bootstrapDoneRef.current = true;
  }, [tableId, normalizedEmail, messages]);

  useEffect(() => {
    if (!tableId) {
      return;
    }
    void refreshMessages();
  }, [tableId, preferServer, refreshMessages]);

  useEffect(() => {
    if (!tableId) {
      return;
    }
    const intervalMs = open ? OPEN_POLL_MS : CLOSED_POLL_MS;
    const timer = window.setInterval(() => void refreshMessages(), intervalMs);
    return () => window.clearInterval(timer);
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
    messages,
    unreadCount,
    sending,
    sendMessage,
    refreshMessages,
    markSeen,
  };
}
