import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { selectSessionUser } from '@/features/auth/store/authSlice';
import { useGetConversationsInfiniteQuery } from '@/features/chat/api/chatApi';
import { useSwipeAndMatch } from '@/features/discovery/hooks/useSwipeAndMatch';
import { useRecordProfileViewMutation } from '@/features/matches';
import type { DiscoveryCandidate } from '@/features/discovery/types';
import { useGetProfileQuery } from '@/features/profile/api/profileApi';
import type { Profile } from '@/features/profile/types';
import {
  useBlockUserMutation,
  useReportUserMutation,
  type ReportReason,
} from '@/features/safety/api/safetyApi';
import type { RootStackScreenProps } from '@/navigation/types';
import { Icon, ScreenContainer } from '@/shared/components';
import { showErrorAlert } from '@/shared/utils/alerts';
import { flatPageItems } from '@/shared/utils/pagination';
import { useAppSelector } from '@/store/hooks';
import { colors, fontSize, palette } from '@/theme';

import { BoomActionSheet } from '../components/BoomActionSheet';
import { BoomChatSheet } from '../components/BoomChatSheet';
import { PhotoLightbox } from '../components/PhotoLightbox';
import { SwipeProfileCard } from '../components/SwipeProfileCard';

type Props = RootStackScreenProps<'UserProfile'>;

function toCandidate(profile: Profile): DiscoveryCandidate {
  const extra = profile as Profile & Partial<DiscoveryCandidate>;
  return {
    ...profile,
    distanceKm: extra.distanceKm ?? null,
    commonInterests: extra.commonInterests ?? [],
    isOnline: extra.isOnline ?? false,
    isNew: extra.isNew ?? false,
  };
}

export function UserProfileScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const me = useAppSelector(selectSessionUser);
  const isOwnProfile = me?.id === userId;
  const { data, isLoading, isError } = useGetProfileQuery(userId, {
    refetchOnMountOrArgChange: true,
  });
  const { data: inbox } = useGetConversationsInfiniteQuery(undefined, {
    skip: isOwnProfile,
  });
  const [recordProfileView] = useRecordProfileViewMutation();
  const [swipe] = useSwipeAndMatch();
  const [blockUser] = useBlockUserMutation();
  const [reportUser] = useReportUserMutation();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [optimisticLiked, setOptimisticLiked] = useState(false);

  const profile = data ? toCandidate(data) : null;
  const liked = optimisticLiked || Boolean(data?.liked);

  useEffect(() => {
    if (!isOwnProfile) {
      recordProfileView(userId);
    }
  }, [isOwnProfile, recordProfileView, userId]);

  useEffect(() => {
    setOptimisticLiked(false);
  }, [userId]);

  const handleLike = async () => {
    if (!profile || liked || isOwnProfile) {
      return;
    }
    setOptimisticLiked(true);
    try {
      await swipe({ targetUserId: profile.id, action: 'like' });
    } catch (error) {
      setOptimisticLiked(false);
      showErrorAlert(error);
    }
  };

  const handleShareProfile = async () => {
    if (!profile) {
      return;
    }
    try {
      await Share.share({
        message: t('profile.shareMessage', { name: profile.name }),
      });
    } catch {
      // User dismissed the share sheet.
    }
  };

  const openChat = () => {
    if (isOwnProfile) {
      return;
    }
    const conversation = flatPageItems(inbox).find(
      item => item.user?.id === userId,
    );
    if (conversation) {
      navigation.navigate('Chat', { conversationId: conversation.id });
      return;
    }
    setChatOpen(true);
  };

  const handleBlock = async () => {
    if (!profile) {
      return;
    }
    try {
      await blockUser(profile.id).unwrap();
      navigation.goBack();
    } catch (error) {
      showErrorAlert(error);
    }
  };

  const handleReport = async (reason: ReportReason) => {
    if (!profile) {
      return;
    }
    try {
      await reportUser({ userId: profile.id, reason }).unwrap();
      setActionsOpen(false);
    } catch (error) {
      showErrorAlert(error);
    }
  };

  return (
    <ScreenContainer edges={['top']}>
      {isLoading && !profile ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textPrimary} />
        </View>
      ) : !profile || isError ? (
        <View style={styles.center}>
          <Text style={styles.empty}>{t('profile.notFound')}</Text>
          <Text style={styles.emptyHint}>{t('profile.notFoundHint')}</Text>
        </View>
      ) : (
        <SwipeProfileCard
          profile={profile}
          photoIndex={photoIndex}
          onSelectPhoto={setPhotoIndex}
          onMessage={openChat}
          onMore={() => setActionsOpen(true)}
          onOpenPhoto={index => {
            setPhotoIndex(index);
            setLightboxOpen(true);
          }}
          showLikeButton={!isOwnProfile}
          showMessageButton={!isOwnProfile}
          showShareButton={isOwnProfile}
          liked={liked}
          onLike={handleLike}
          onShare={handleShareProfile}
        />
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.goBack()}
        style={[styles.back, { top: insets.top + 12 }]}
      >
        <Icon name="chevron-back" size={22} color={colors.textPrimary} />
      </Pressable>

      <BoomChatSheet
        visible={chatOpen}
        profile={profile}
        onClose={() => setChatOpen(false)}
        onBlock={handleBlock}
        onReport={() => {
          setChatOpen(false);
          setActionsOpen(true);
        }}
            onFirstMessage={() => undefined}
      />
      <BoomActionSheet
        visible={actionsOpen}
        profile={profile}
        onClose={() => setActionsOpen(false)}
        onBlock={handleBlock}
        onReport={handleReport}
      />
      <PhotoLightbox
        visible={lightboxOpen}
        photos={profile?.photos ?? []}
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
  back: {
    position: 'absolute',
    left: 16,
    zIndex: 6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(20,20,20,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.gray750,
  },
});
