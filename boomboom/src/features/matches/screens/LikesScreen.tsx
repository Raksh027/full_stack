import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { useSwipeAndMatch } from '@/features/discovery/hooks/useSwipeAndMatch';
import { homeAccent } from '@/features/discovery/theme';
import { Icon, InfiniteListFooter, ScreenContainer } from '@/shared/components';
import { showErrorAlert } from '@/shared/utils/alerts';
import { flatPageItems, loadMoreIfNeeded } from '@/shared/utils/pagination';
import { colors, fontSize, screen } from '@/theme';

import {
  useGetLikesReceivedInfiniteQuery,
  useGetLikesSentInfiniteQuery,
  useGetMatchesInfiniteQuery,
  useGetRecentlyViewedInfiniteQuery,
  useRemoveLikeMutation,
  useRespondToLikeMutation,
} from '../api/matchesApi';
import { LikeProfileCard } from '../components/LikeProfileCard';
import { LikesTabs, type LikesTab } from '../components/LikesTabs';
import type { LikeProfile, Match } from '../types';

const GAP = 12;
const PAD = 16;
const CARD_WIDTH = (screen.width - PAD * 2 - GAP) / 2;

type CardItem = {
  id: string;
  profile: LikeProfile;
  liked: boolean;
  showActions: boolean;
  isMatch: boolean;
  isLikedYou: boolean;
  isViewed: boolean;
  conversationId?: string;
};

export function LikesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [tab, setTab] = useState<LikesTab>('sent');
  const sentQuery = useGetLikesSentInfiniteQuery();
  const receivedQuery = useGetLikesReceivedInfiniteQuery();
  const viewedQuery = useGetRecentlyViewedInfiniteQuery();
  const matchesQuery = useGetMatchesInfiniteQuery();
  const [respondToLike] = useRespondToLikeMutation();
  const [removeLike] = useRemoveLikeMutation();
  const [swipe] = useSwipeAndMatch();

  useFocusEffect(
    useCallback(() => {
      void sentQuery.refetch();
      void receivedQuery.refetch();
      void viewedQuery.refetch();
      void matchesQuery.refetch();
    }, [
      matchesQuery.refetch,
      receivedQuery.refetch,
      sentQuery.refetch,
      viewedQuery.refetch,
    ]),
  );

  const sent = useMemo(
    () => flatPageItems(sentQuery.data),
    [sentQuery.data],
  );
  const received = useMemo(
    () => flatPageItems(receivedQuery.data),
    [receivedQuery.data],
  );
  const viewed = useMemo(
    () => flatPageItems(viewedQuery.data),
    [viewedQuery.data],
  );
  const matches = useMemo(
    () => flatPageItems(matchesQuery.data),
    [matchesQuery.data],
  );

  const emptyCopy = {
    sent: { title: t('likes.empty.sentTitle'), hint: t('likes.empty.sentHint') },
    received: {
      title: t('likes.empty.receivedTitle'),
      hint: t('likes.empty.receivedHint'),
    },
    viewed: {
      title: t('likes.empty.viewedTitle'),
      hint: t('likes.empty.viewedHint'),
    },
    matches: {
      title: t('likes.empty.matchesTitle'),
      hint: t('likes.empty.matchesHint'),
    },
  } as const;

  const likedIds = useMemo(() => new Set(sent.map(item => item.user.id)), [sent]);

  const items: CardItem[] = useMemo(() => {
    if (tab === 'sent') {
      return sent.map(item => ({
        id: item.id,
        profile: item.user,
        liked: true,
        showActions: false,
        isMatch: false,
        isLikedYou: false,
        isViewed: false,
      }));
    }
    if (tab === 'received') {
      return received.map(item => ({
        id: item.id,
        profile: item.user,
        liked: false,
        showActions: true,
        isMatch: false,
        isLikedYou: true,
        isViewed: false,
      }));
    }
    if (tab === 'viewed') {
      return viewed.map(item => ({
        id: item.id,
        profile: item.user,
        liked: likedIds.has(item.user.id),
        showActions: false,
        isMatch: false,
        isLikedYou: false,
        isViewed: true,
      }));
    }
    return matches.map((item: Match) => ({
      id: item.id,
      profile: item.user,
      liked: true,
      showActions: false,
      isMatch: true,
      isLikedYou: false,
      isViewed: false,
      conversationId: item.conversationId,
    }));
  }, [likedIds, matches, received, sent, tab, viewed]);

  const activeQuery =
    tab === 'sent'
      ? sentQuery
      : tab === 'received'
        ? receivedQuery
        : tab === 'viewed'
          ? viewedQuery
          : matchesQuery;
  const loading = activeQuery.isLoading;

  const openCard = (item: CardItem) => {
    if (tab === 'matches' && item.conversationId) {
      navigation.navigate('Chat', { conversationId: item.conversationId });
      return;
    }
    navigation.navigate('UserProfile', { userId: item.profile.id });
  };

  const handleLike = async (item: CardItem) => {
    try {
      if (tab === 'received') {
        const result = await respondToLike({
          likeId: item.id,
          action: 'like',
        }).unwrap();
        if (result.match) {
          navigation.navigate('ItsAMatch', {
            matchId: result.match.id,
            conversationId: result.match.conversationId,
            name: result.match.user?.name ?? undefined,
            photo: result.match.user?.photos?.[0]?.url ?? null,
          });
        }
        return;
      }
      if (tab === 'sent' && item.liked) {
        await removeLike(item.profile.id).unwrap();
        return;
      }
      await swipe({ targetUserId: item.profile.id, action: 'like' });
    } catch (error) {
      showErrorAlert(error);
    }
  };

  return (
    <ScreenContainer edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('likes.title')}</Text>
        <Text style={styles.subtitle}>{t('likes.subtitle')}</Text>
      </View>

      <LikesTabs
        active={tab}
        counts={{
          sent: sent.length,
          received: received.length,
          viewed: viewed.length,
          matches: matches.length,
        }}
        onChange={setTab}
      />

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textPrimary} />
        </View>
      ) : (
        <FlatList
          data={items}
          key={tab}
          numColumns={2}
          keyExtractor={item => item.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReached={() => loadMoreIfNeeded(activeQuery)}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <InfiniteListFooter loading={activeQuery.isFetchingNextPage} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="heart-outline" size={26} color={homeAccent.yellow} />
              </View>
              <Text style={styles.emptyTitle}>{emptyCopy[tab].title}</Text>
              <Text style={styles.emptyHint}>{emptyCopy[tab].hint}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <LikeProfileCard
              profile={item.profile}
              width={CARD_WIDTH}
              showActions={item.showActions}
              isMatch={item.isMatch}
              isLikedYou={item.isLikedYou}
              isViewed={item.isViewed}
              onPress={() => openCard(item)}
              onLike={() => handleLike(item)}
              onPass={() =>
                respondToLike({ likeId: item.id, action: 'pass' })
              }
            />
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize(26),
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: fontSize(13),
  },
  list: {
    paddingHorizontal: PAD,
    paddingTop: 16,
    paddingBottom: 120,
    flexGrow: 1,
  },
  row: {
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 72,
    paddingHorizontal: 28,
    gap: 8,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1A1600',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(18),
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: fontSize(13),
    textAlign: 'center',
  },
});
