import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addTableMessage, getTableMessages } from './tableChatService';
import { mergeTableMessagesById, type TableChatMessage } from './tableMessagingTypes';
import './TableChatDock.css';

const CHAT_EMOJIS = [
  '🎲',
  '🎰',
  '🃏',
  '♠️',
  '♥️',
  '♦️',
  '♣️',
  '🪙',
  '💰',
  '🏆',
  '🔥',
  '😂',
  '👀',
  '😎',
  '🤝',
  '🍀',
];

const OPEN_POLL_MS = 2000;
const CLOSED_POLL_MS = 5000;

export interface TableChatDockProps {
  tableId: string;
  currentUserEmail?: string | null;
  currentUserName?: string | null;
  /** Use shared server chat when the table is online/server-backed. */
  preferServer?: boolean;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function senderLabel(message: TableChatMessage): string {
  if (message.senderName?.trim()) {
    return message.senderName.trim();
  }
  if (message.senderEmail.includes('@')) {
    return message.senderEmail.split('@')[0] || 'Guest';
  }
  return 'Guest';
}

export function TableChatDock({
  tableId,
  currentUserEmail,
  currentUserName,
  preferServer = false,
}: TableChatDockProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<TableChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [lastReadCount, setLastReadCount] = useState(0);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const normalizedEmail = (currentUserEmail ?? 'guest@local').trim().toLowerCase() || 'guest@local';
  const displayName = currentUserName?.trim() || 'Guest';

  const unreadCount = useMemo(() => {
    if (open) {
      return 0;
    }
    return Math.max(0, messages.length - lastReadCount);
  }, [open, messages.length, lastReadCount]);

  const refreshMessages = useCallback(async () => {
    if (!tableId) {
      return;
    }
    const fetched = await getTableMessages(tableId, { preferServer });
    setMessages((current) => mergeTableMessagesById(current, fetched));
  }, [tableId, preferServer]);

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
    const timer = window.setInterval(() => {
      void refreshMessages();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [tableId, open, refreshMessages]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setLastReadCount(messages.length);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, messages]);

  function handleOpen() {
    setOpen(true);
    void refreshMessages();
  }

  function handleClose() {
    setOpen(false);
    setLastReadCount(messages.length);
  }

  function appendEmoji(emoji: string) {
    setDraft((prev) => `${prev}${emoji}`);
  }

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || sending) {
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
      setDraft('');
      await refreshMessages();
    } catch {
      // Validation errors are ignored in UI — empty sends are blocked client-side.
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  if (!tableId) {
    return null;
  }

  return (
    <div className="table-chat-dock" data-table-id={tableId}>
      {!open ? (
        <button type="button" className="table-chat-toggle" onClick={handleOpen}>
          Chat
          {unreadCount > 0 && (
            <span className="table-chat-toggle__badge" aria-label={`${unreadCount} unread`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <div className="table-chat-panel" role="region" aria-label="Table Chat">
          <div className="table-chat-panel__header">
            <span>Table Chat</span>
            <button type="button" className="table-chat-panel__close" onClick={handleClose} aria-label="Close chat">
              ×
            </button>
          </div>
          <div className="table-chat-messages">
            {messages.length === 0 && (
              <p className="table-chat-message__body">No messages yet. Say hello to the table.</p>
            )}
            {messages.map((message) => {
              const isSelf =
                message.type === 'user' &&
                message.senderEmail.trim().toLowerCase() === normalizedEmail;
              return (
                <article
                  key={message.id}
                  className={`table-chat-message${isSelf ? ' table-chat-message--self' : ''}`}
                >
                  <div className="table-chat-message__meta">
                    <span>{senderLabel(message)}</span>
                    <time dateTime={message.createdAt}>{formatTimestamp(message.createdAt)}</time>
                  </div>
                  <p className="table-chat-message__body">{message.body}</p>
                </article>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="table-chat-emoji-row" aria-label="Emoji picker">
            {CHAT_EMOJIS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => appendEmoji(emoji)} aria-label={`Add ${emoji}`}>
                {emoji}
              </button>
            ))}
          </div>
          <div className="table-chat-input">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message the table…"
              rows={2}
              maxLength={500}
              aria-label="Chat message"
            />
            <button type="button" onClick={() => void handleSend()} disabled={!draft.trim() || sending}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
