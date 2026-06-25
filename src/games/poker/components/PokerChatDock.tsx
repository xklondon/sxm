import { useState, type FormEvent } from 'react';
import type { PokerChatMessage } from '../state/pokerTypes';

interface PokerChatDockProps {
  messages: PokerChatMessage[];
  actionLog: string[];
  onSendMessage?: (message: string) => void;
  readOnly?: boolean;
  unreadCount?: number;
  sending?: boolean;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function PokerChatDock({
  messages,
  actionLog,
  onSendMessage,
  readOnly = false,
  unreadCount = 0,
  sending = false,
}: PokerChatDockProps) {
  const [draft, setDraft] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || !onSendMessage) {
      return;
    }
    onSendMessage(trimmed);
    setDraft('');
  }

  return (
    <aside
      className={`poker-chat${collapsed ? ' poker-chat--collapsed' : ''}`}
      aria-label="Table chat and action log"
      data-testid="poker-chat-dock"
    >
      <button
        type="button"
        className="poker-chat__toggle"
        onClick={() => setCollapsed((value) => !value)}
        aria-expanded={!collapsed}
      >
        <h3 className="poker-chat__title">Table chat</h3>
        {unreadCount > 0 && !collapsed && (
          <span className="poker-chat__badge" aria-label={`${unreadCount} unread`}>
            {unreadCount}
          </span>
        )}
        {unreadCount > 0 && collapsed && (
          <span className="poker-chat__badge" aria-label={`${unreadCount} unread`}>
            {unreadCount}
          </span>
        )}
      </button>

      <div className="poker-chat__body">
        <section className="poker-chat__log">
          <h3 className="poker-chat__title">Action log</h3>
          <ul className="poker-chat__action-list">
            {actionLog.slice(-8).map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ul>
        </section>

        <section className="poker-chat__messages">
          <h3 className="poker-chat__title">Chat</h3>
          <ul className="poker-chat__message-list">
            {messages.length === 0 ? (
              <li className="poker-chat__empty">No messages yet.</li>
            ) : (
              messages.map((message) => (
                <li key={message.id} className="poker-chat__message">
                  <span className="poker-chat__author">{message.author}</span>
                  <span className="poker-chat__time">{formatTime(message.timestamp)}</span>
                  <p className="poker-chat__body">{message.body}</p>
                </li>
              ))
            )}
          </ul>
        </section>

        {!readOnly && (
          <form className="poker-chat__composer" onSubmit={handleSubmit}>
            <input
              type="text"
              className="poker-chat__input"
              placeholder="Say something at the table…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={500}
              disabled={sending}
            />
            <button type="submit" disabled={!draft.trim() || sending}>
              Send
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
