import type { ChatMessage } from '../../types';
import { upsertMessage } from '../messageCache';

const message = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: 'm1',
  clientId: null,
  conversationId: 'c1',
  senderId: 'u1',
  body: 'hi',
  createdAt: '2026-01-01T00:00:00Z',
  status: 'sent',
  ...overrides,
});

describe('upsertMessage', () => {
  it('prepends new messages to the newest page', () => {
    const draft = {
      pages: [{ items: [message({ id: 'old' })], nextCursor: null }],
    };
    upsertMessage(draft, message({ id: 'new' }));
    expect(draft.pages[0]?.items.map(m => m.id)).toEqual(['new', 'old']);
  });

  it('replaces an optimistic message once the server confirms it', () => {
    const pending = message({ id: 'tmp', clientId: 'tmp', status: 'sending' });
    const draft = { pages: [{ items: [pending], nextCursor: null }] };
    upsertMessage(draft, message({ id: 'server-id', clientId: 'tmp' }));
    expect(draft.pages[0]?.items).toHaveLength(1);
    expect(draft.pages[0]?.items[0]).toMatchObject({
      id: 'server-id',
      status: 'sent',
    });
  });
});
