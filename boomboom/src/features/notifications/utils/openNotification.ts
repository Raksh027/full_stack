import { navigate } from '@/navigation/navigationRef';

import type { InboxNotification } from '../api/notificationsApi';

function dataString(item: InboxNotification, key: string): string | undefined {
  const value = item.data?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export type NotificationKind = 'like' | 'match' | 'view' | 'offer' | 'other';

export function actorUserId(item: InboxNotification): string | undefined {
  return (
    dataString(item, 'userId') ??
    dataString(item, 'user_id') ??
    dataString(item, 'actorId') ??
    dataString(item, 'actor_id') ??
    (item.relatedEntityType === 'user' ? item.relatedEntityId ?? undefined : undefined)
  );
}

export function actorPhoto(item: InboxNotification): string | undefined {
  return dataString(item, 'photo') ?? dataString(item, 'photoUrl');
}

export function actorName(item: InboxNotification): string | undefined {
  return dataString(item, 'name');
}

export function notificationKind(item: InboxNotification): NotificationKind {
  const kind = (dataString(item, 'kind') ?? '').toLowerCase();
  if (kind === 'like' || kind === 'match' || kind === 'view' || kind === 'offer') {
    return kind;
  }
  const type = (item.type || '').toUpperCase();
  if (type.includes('OFFER') || type.includes('SUPERLIKE')) {
    return 'offer';
  }
  if (type.includes('LIKE') || type.includes('FAVORITE')) {
    return 'like';
  }
  if (type.includes('MATCH')) {
    return 'match';
  }
  if (type.includes('VIEW') || type.includes('PROFILE')) {
    return 'view';
  }
  return 'other';
}

export function openNotification(item: InboxNotification) {
  const type = (item.type || '').toUpperCase();
  const kind = notificationKind(item);
  const userId = actorUserId(item);
  const conversationId =
    dataString(item, 'conversationId') ?? dataString(item, 'conversation_id');
  const matchId = dataString(item, 'matchId');

  if (kind === 'like' || kind === 'offer' || kind === 'view') {
    if (userId) {
      navigate('UserProfile', { userId });
      return;
    }
    navigate('Main', { screen: 'Likes' });
    return;
  }

  if (kind === 'match' || type.includes('MATCH')) {
    if (conversationId) {
      navigate('Chat', { conversationId });
      return;
    }
    if (userId) {
      navigate('UserProfile', { userId });
      return;
    }
    if (matchId) {
      navigate('ItsAMatch', {
        matchId,
        conversationId: conversationId ?? matchId,
        name: actorName(item),
        photo: actorPhoto(item) ?? null,
      });
      return;
    }
  }

  if (type.includes('MESSAGE') && conversationId) {
    navigate('Chat', { conversationId });
    return;
  }
  if (type.includes('TRAVEL')) {
    if (userId) {
      navigate('UserProfile', { userId });
      return;
    }
    navigate('TravelAlert', undefined);
    return;
  }
  if (type.includes('EVENT') || type.includes('TONIGHT')) {
    if (userId) {
      navigate('UserProfile', { userId });
      return;
    }
    navigate('FreeTonight', undefined);
    return;
  }
  if (type.includes('SUBSCRIPTION')) {
    navigate('Paywall', undefined);
    return;
  }
  if (type.includes('VERIFICATION')) {
    navigate('Main', { screen: 'Discover' });
    return;
  }
  if (userId) {
    navigate('UserProfile', { userId });
    return;
  }
  navigate('Notifications', undefined);
}
