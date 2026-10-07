import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useGetDiscoveryFeedInfiniteQuery } from '@/features/discovery/api/discoveryApi';
import { useSwipeAndMatch } from '@/features/discovery/hooks/useSwipeAndMatch';
import type { DiscoveryCandidate, SwipeAction } from '@/features/discovery/types';
import {
  useBlockUserMutation,
  useReportUserMutation,
  type ReportReason,
} from '@/features/safety/api/safetyApi';
import { ScreenContainer } from '@/shared/components';
import { showErrorAlert } from '@/shared/utils/alerts';
import { flatPageItems } from '@/shared/utils/pagination';
import { colors, fontSize } from '@/theme';

import { BoomActionSheet } from '../components/BoomActionSheet';
import { BoomChatSheet } from '../components/BoomChatSheet';
import { PhotoLightbox } from '../components/PhotoLightbox';
import { SwipeDeck } from '../components/SwipeDeck';

export function BoomScreen() {
  const { t } = useTranslation();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useGetDiscoveryFeedInfiniteQuery();
  const [swipe] = useSwipeAndMatch();
  const [blockUser] = useBlockUserMutation();
  const [reportUser] = useReportUserMutation();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const feedItems = useMemo(
    () => flatPageItems(data),
    [data],
  );
  const queue = useMemo(() => {
    return feedItems.filter(item => !dismissed.includes(item.id));
  }, [dismissed, feedItems]);

  const current = queue[0] ?? null;
  const next = queue[1];

  useEffect(() => {
    setPhotoIndex(0);
  }, [current?.id]);

  useEffect(() => {
    if (queue.length < 4 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [queue.length, hasNextPage, fetchNextPage, isFetchingNextPage]);

  const dismiss = (profile: DiscoveryCandidate) => {
    setDismissed(ids => [...ids, profile.id]);
    setChatOpen(false);
    setActionsOpen(false);
    setLightboxOpen(false);
  };

  const handleSwipe = (action: SwipeAction) => {
    if (!current) {
      return;
    }
    swipe({ targetUserId: current.id, action });
    dismiss(current);
  };

  const handleBlock = async () => {
    if (!current) {
      return;
    }
    try {
      await blockUser(current.id).unwrap();
      dismiss(current);
    } catch (error) {
      showErrorAlert(error);
    }
  };

  const handleReport = async (reason: ReportReason) => {
    if (!current) {
      return;
    }
    try {
      await reportUser({ userId: current.id, reason }).unwrap();
      setActionsOpen(false);
      dismiss(current);
    } catch (error) {
      showErrorAlert(error);
    }
  };

  return (
    <ScreenContainer edges={['top']}>
      {isLoading && !current ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textPrimary} />
        </View>
      ) : current ? (
        <SwipeDeck
          current={current}
          next={next}
          photoIndex={photoIndex}
          onSelectPhoto={setPhotoIndex}
          onMessage={() => setChatOpen(true)}
          onMore={() => setActionsOpen(true)}
          onOpenPhoto={index => {
            setPhotoIndex(index);
            setLightboxOpen(true);
          }}
          onSwipe={handleSwipe}
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.empty}>{t('boom.noMore')}</Text>
          <Text style={styles.emptyHint}>{t('boom.noMoreHint')}</Text>
        </View>
      )}

      <BoomChatSheet
        visible={chatOpen}
        profile={current}
        onClose={() => setChatOpen(false)}
        onBlock={handleBlock}
        onReport={() => {
          setChatOpen(false);
          setActionsOpen(true);
        }}
        onFirstMessage={() => {
          if (current) {
            swipe({ targetUserId: current.id, action: 'like' });
          }
        }}
      />
      <BoomActionSheet
        visible={actionsOpen}
        profile={current}
        onClose={() => setActionsOpen(false)}
        onBlock={handleBlock}
        onReport={handleReport}
      />
      <PhotoLightbox
        visible={lightboxOpen}
        photos={current?.photos ?? []}
        index={photoIndex}
        onClose={() => setLightboxOpen(false)}
        onChange={setPhotoIndex}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  empty: {
    color: colors.textPrimary,
    fontSize: fontSize(22),
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyHint: {
    color: colors.textSecondary,
    fontSize: fontSize(14),
    textAlign: 'center',
  },
});
