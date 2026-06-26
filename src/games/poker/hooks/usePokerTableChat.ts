import { useMemo } from 'react';
import { useTableChat, type UseTableChatOptions } from '../../../features/messaging/useTableChat';
import type { TableChatMessage } from '../../../features/messaging/tableMessagingTypes';
import type { PokerChatMessage } from '../state/pokerTypes';

function mapTableChatMessage(message: TableChatMessage): PokerChatMessage {
  return {
    id: message.id,
    author: message.senderName?.trim() || message.senderEmail.split('@')[0] || 'Guest',
    body: message.body,
    timestamp: Date.parse(message.createdAt) || Date.now(),
  };
}

export type UsePokerTableChatOptions = UseTableChatOptions;

/** Poker layout wrapper around the shared table chat hook/service. */
export function usePokerTableChat(options: UsePokerTableChatOptions) {
  const chat = useTableChat({ ...options, open: options.open ?? true });
  const pokerMessages = useMemo(
    () => chat.messages.map(mapTableChatMessage),
    [chat.messages],
  );
  return {
    ...chat,
    messages: pokerMessages,
  };
}
