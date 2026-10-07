import type { CursorPage } from '@/shared/types/api';

import type { ChatMessage } from '../types';

type MessagePages = { pages: CursorPage<ChatMessage>[] };

/** Inserts or replaces a message, matching on server id or optimistic client id. */
export function upsertMessage(draft: MessagePages, message: ChatMessage) {
  if (!draft?.pages) {
    return;
  }
  for (const page of draft.pages) {
    const items = page.items ?? [];
    page.items = items;
    const index = items.findIndex(
      item =>
        item.id === message.id ||
        (message.clientId !== null && item.clientId === message.clientId),
    );
    if (index !== -1) {
      items[index] = message;
      return;
    }
  }
  if (!draft.pages[0]) {
    draft.pages[0] = { items: [message], nextCursor: null };
    return;
  }
  draft.pages[0].items = draft.pages[0].items ?? [];
  draft.pages[0].items.unshift(message);
}
