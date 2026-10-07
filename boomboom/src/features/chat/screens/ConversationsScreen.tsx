import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { selectSessionUser } from '@/features/auth/store/authSlice';
import { useSwipeAndMatch } from '@/features/discovery/hooks/useSwipeAndMatch';
import { homeAccent } from '@/features/discovery/theme';
import type { MainTabScreenProps } from '@/navigation/types';
import { Icon, InfiniteListFooter, ScreenContainer } from '@/shared/components';
import { flatPageItems, loadMoreIfNeeded } from '@/shared/utils/pagination';
import { useAppSelector } from '@/store/hooks';
import { colors, fontSize, palette } from '@/theme';

import { realtime } from '@/services/realtime/realtime';

import { useGetConversationsInfiniteQuery } from '../api/chatApi';
import { ConversationRow } from '../components/ConversationRow';
import { NewMatchRail } from '../components/NewMatchRail';
import type { Conversation } from '../types';

type Props = MainTabScreenProps<'Conversations'>;

export function ConversationsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const me = useAppSelector(selectSessionUser);
  const onlineUserIds = useAppSelector(state => state.chat.onlineUserIds);
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    refetch,
    fetchNextPage,
    hasNextPage,
  } = useGetConversationsInfiniteQuery();
  const [swipe] = useSwipeAndMatch();
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [resolvedRequests, setResolvedRequests] = useState<string[]>([]);
  const [safetyPromptedIds, setSafetyPromptedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const conversations = useMemo(() => {
    const items = flatPageItems(data);
    return [...items]
      .filter(item => !hiddenIds.includes(item.id))
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      );
  }, [data, hiddenIds]);

  useEffect(() => {
    const userIds = conversations.map(item => item.user.id);
    if (userIds.length) {
      realtime.send('presence.subscribe', { userIds });
    }
  }, [conversations]);

  const newMatches = conversations.filter(item => !item.lastMessage);
  const chats = conversations.filter(item => item.lastMessage);
  const filtered = chats.filter(item => {
    const matchesQuery = item.user.name
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    const matchesUnread = !unreadOnly || item.unreadCount > 0;
    return matchesQuery && matchesUnread;
  });

  const openChat = (conversation: Conversation) => {
    const accepted = resolvedRequests.includes(conversation.id);
    const showSafetyPrompt =
      accepted && !safetyPromptedIds.includes(conversation.id);
    if (showSafetyPrompt) {
      setSafetyPromptedIds(ids =>
        ids.includes(conversation.id) ? ids : [...ids, conversation.id],
      );
    }
    navigation.navigate('Chat', {
      conversationId: conversation.id,
      requestAccepted: accepted,
      showSafetyPrompt,
    });
  };

  const previewFor = (conversation: Conversation) => {
    if (conversation.isRequest && !resolvedRequests.includes(conversation.id)) {
      return t('chat.requestPreview');
    }
    const body = conversation.lastMessage?.body?.trim();
    return body && body.length > 0 ? body : t('chat.sayHi');
  };

  const isPendingRequest = (conversation: Conversation) =>
    Boolean(conversation.isRequest) &&
    !resolvedRequests.includes(conversation.id);

  const acceptRequest = (conversation: Conversation) => {
    setResolvedRequests(ids =>
      ids.includes(conversation.id) ? ids : [...ids, conversation.id],
    );
    swipe({ targetUserId: conversation.user.id, action: 'like' });
  };

  const declineRequest = (conversation: Conversation) => {
    setHiddenIds(ids =>
      ids.includes(conversation.id) ? ids : [...ids, conversation.id],
    );
    setResolvedRequests(ids =>
      ids.includes(conversation.id) ? ids : [...ids, conversation.id],
    );
    swipe({ targetUserId: conversation.user.id, action: 'pass' });
  };

  return (
    <ScreenContainer edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('chat.title')}</Text>
          <Text style={styles.subtitle}>{t('chat.subtitle')}</Text>
        </View>
      </View>

      <View style={styles.search}>
        <Icon name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('chat.search')}
          placeholderTextColor={palette.gray500}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Icon name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filters}>
        <Pressable
          onPress={() => setUnreadOnly(false)}
          style={[styles.chip, !unreadOnly && styles.chipOn]}
        >
          <Text style={styles.chipLabel}>{t('chat.all')}</Text>
        </Pressable>
        <Pressable
          onPress={() => setUnreadOnly(true)}
          style={[styles.chip, unreadOnly && styles.chipOn]}
        >
          <View style={styles.unreadDot} />
          <Text style={styles.chipLabel}>{t('chat.unread')}</Text>
        </Pressable>
      </View>

      {isLoading && conversations.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.textPrimary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          refreshing={isFetching && conversations.length > 0}
          onRefresh={refetch}
          onEndReached={() =>
            loadMoreIfNeeded({ hasNextPage, isFetchingNextPage, fetchNextPage })
          }
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <InfiniteListFooter loading={isFetchingNextPage} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            query.length === 0 && !unreadOnly && newMatches.length > 0 ? (
              <View style={styles.railBlock}>
                <Text style={styles.section}>{t('chat.newMatches')}</Text>
                <NewMatchRail matches={newMatches} onPress={openChat} />
                <Text style={[styles.section, styles.chatsLabel]}>
                  {t('chat.chats')}
                </Text>
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="chatbubbles-outline" size={28} color={homeAccent.yellow} />
              </View>
              <Text style={styles.emptyTitle}>
                {query || unreadOnly ? t('chat.emptySearch') : t('chat.emptyTitle')}
              </Text>
              <Text style={styles.emptyHint}>
                {query || unreadOnly ? t('chat.emptySearchHint') : t('chat.emptyHint')}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              preview={previewFor(item)}
              isOnline={Boolean(onlineUserIds[item.user.id])}
              isMine={item.lastMessage?.senderId === me?.id}
              showRequestActions={isPendingRequest(item)}
              onPress={() => openChat(item)}
              onAccept={() => acceptRequest(item)}
              onDecline={() => declineRequest(item)}
            />
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(28),
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: fontSize(13),
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.gray900,
    borderWidth: 1,
    borderColor: palette.gray750,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize(14),
    paddingVertical: 0,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: palette.gray900,
    borderWidth: 1,
    borderColor: palette.gray750,
  },
  chipOn: {
    borderColor: homeAccent.yellow,
    backgroundColor: '#1A1600',
  },
  chipLabel: {
    color: colors.textPrimary,
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: homeAccent.yellow,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: 120,
    flexGrow: 1,
  },
  railBlock: {
    paddingTop: 8,
    paddingBottom: 6,
    gap: 12,
  },
  section: {
    paddingHorizontal: 16,
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '800',
  },
  chatsLabel: {
    marginTop: 10,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 72,
    gap: 8,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1A1600',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(18),
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: fontSize(13),
    textAlign: 'center',
    lineHeight: 19,
  },
});
