import { useEffect, useRef, useState } from 'react';
import { useTableChat } from './useTableChat';
import type { TableChatMessage } from './tableMessagingTypes';
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

const UNREAD_PULSE_MS = 1200;

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
  const [draft, setDraft] = useState('');
  const [pulseUnread, setPulseUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const prevUnreadRef = useRef(0);
  const normalizedEmail = (currentUserEmail ?? 'guest@local').trim().toLowerCase() || 'guest@local';

  const { messages, unreadCount, sending, sendMessage, refreshMessages, markSeen } = useTableChat({
    tableId,
    currentUserEmail,
    currentUserName,
    preferServer,
    open,
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [open, messages]);

  useEffect(() => {
    if (open) {
      prevUnreadRef.current = 0;
      setPulseUnread(false);
      return;
    }
    if (unreadCount > prevUnreadRef.current && unreadCount > 0) {
      setPulseUnread(true);
      const timer = window.setTimeout(() => setPulseUnread(false), UNREAD_PULSE_MS);
      prevUnreadRef.current = unreadCount;
      return () => window.clearTimeout(timer);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, open]);

  function handleOpen() {
    setOpen(true);
    void refreshMessages();
  }

  function handleClose() {
    setOpen(false);
    markSeen(messages);
  }

  function appendEmoji(emoji: string) {
    setDraft((prev) => `${prev}${emoji}`);
  }

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || sending) {
      return;
    }
    try {
      await sendMessage(trimmed);
      setDraft('');
    } catch {
      // Validation errors are ignored in UI — empty sends are blocked client-side.
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  const unreadBadgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  if (!tableId) {
    return null;
  }

  return (
    <div className="table-chat-dock" data-table-id={tableId}>
      {!open ? (
        <button
          type="button"
          className={`table-chat-toggle${pulseUnread ? ' table-chat-toggle--pulse' : ''}`}
          onClick={handleOpen}
          aria-label={unreadCount > 0 ? `Chat, ${unreadCount} unread messages` : 'Open table chat'}
          title={unreadCount > 0 ? `${unreadCount} unread messages` : 'Open table chat'}
        >
          <span className="table-chat-toggle__label">Chat</span>
          {unreadCount > 0 ? (
            <span className="table-chat-toggle__badge" aria-hidden="true">
              {unreadBadgeLabel}
            </span>
          ) : null}
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
