import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { images } from '@/assets';
import { homeAccent } from '@/features/discovery/theme';
import {
  useGetNotificationsInfiniteQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  type InboxNotification,
} from '@/features/notifications/api/notificationsApi';
import {
  actorName,
  actorPhoto,
  actorUserId,
  notificationKind,
  openNotification,
  type NotificationKind,
} from '@/features/notifications/utils/openNotification';
import type { RootStackScreenProps } from '@/navigation/types';
import {
  BackButton,
  Icon,
  InfiniteListFooter,
  ScreenContainer,
  type IconName,
} from '@/shared/components';
import { flatPageItems, loadMoreIfNeeded } from '@/shared/utils/pagination';
import { colors, fontSize, palette } from '@/theme';

type Props = RootStackScreenProps<'Notifications'>;
type InboxFilter = 'all' | 'likes' | 'matches' | 'views' | 'offers';

const FILTERS: InboxFilter[] = ['all', 'likes', 'matches', 'views', 'offers'];

function filterKey(filter: InboxFilter): NotificationKind | 'all' {
  if (filter === 'likes') {
    return 'like';
  }
  if (filter === 'matches') {
    return 'match';
  }
  if (filter === 'views') {
    return 'view';
  }
  if (filter === 'offers') {
    return 'offer';
  }
  return 'all';
}

function iconForKind(kind: NotificationKind): IconName {
  if (kind === 'like') {
    return 'heart';
  }
  if (kind === 'match') {
    return 'people';
  }
  if (kind === 'view') {
    return 'eye';
  }
  if (kind === 'offer') {
    return 'star';
  }
  return 'notifications';
}

function badgeColor(kind: NotificationKind): string {
  if (kind === 'like') {
    return '#FF4D6A';
  }
  if (kind === 'match') {
    return homeAccent.yellow;
  }
  if (kind === 'view') {
    return '#3B82F6';
  }
  if (kind === 'offer') {
    return '#F59E0B';
  }
  return homeAccent.purple;
}

function formatTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes < 60) {
    return `${Math.max(minutes, 1)}m`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  return date.toLocaleDateString();
}

export function NotificationsScreen(_props: Props) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<InboxFilter>('all');
  const {
    data,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useGetNotificationsInfiniteQuery();
  const items = flatPageItems(data);
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();
  const hasUnread = items.some(item => !item.isRead);

  const visible = useMemo(() => {
    const wanted = filterKey(filter);
    if (wanted === 'all') {
      return items;
    }
    return items.filter(item => notificationKind(item) === wanted);
  }, [filter, items]);

  const openItem = (item: InboxNotification) => {
    if (!item.isRead) {
      void markRead(item.id);
    }
    openNotification(item);
  };

  return (
    <ScreenContainer edges={['top']}>
      <View style={styles.header}>
        <BackButton style={styles.back} />
        <Text style={styles.title}>{t('notifications.title')}</Text>
        {hasUnread ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => markAllRead()}
            style={styles.markAll}
          >
            <Text style={styles.markAllText}>{t('notifications.markAll')}</Text>
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroller}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map(tab => {
          const selected = tab === filter;
          return (
            <Pressable
              key={tab}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(tab)}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                {t(`notifications.filters.${tab}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={visible}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onEndReached={() =>
          loadMoreIfNeeded({ hasNextPage, isFetchingNextPage, fetchNextPage })
        }
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          <InfiniteListFooter loading={isFetchingNextPage} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.iconWrap}>
              <Icon
                name="notifications-outline"
                size={26}
                color={colors.textSecondary}
              />
            </View>
            <Text style={styles.emptyTitle}>{t('notifications.empty')}</Text>
            <Text style={styles.emptyHint}>{t('notifications.emptyHint')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const kind = notificationKind(item);
          const photo = actorPhoto(item);
          const name = actorName(item);
          const userId = actorUserId(item);
          return (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.row,
                !item.isRead && styles.rowUnread,
                pressed && styles.pressed,
              ]}
              onPress={() => openItem(item)}
            >
              <View style={styles.avatarWrap}>
                <Image
                  source={photo ? { uri: photo } : images.profilePlaceholder}
                  style={styles.avatar}
                />
                <View
                  style={[styles.kindBadge, { backgroundColor: badgeColor(kind) }]}
                >
                  <Icon
                    name={iconForKind(kind)}
                    size={10}
                    color={kind === 'match' ? palette.black : palette.white}
                  />
                </View>
              </View>
              <View style={styles.copy}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {name ?? item.title}
                </Text>
                <Text style={styles.rowBody} numberOfLines={2}>
                  {item.body}
                </Text>
                {userId ? (
                  <Text style={styles.cta}>
                    {kind === 'match'
                      ? t('notifications.openChat')
                      : t('notifications.openProfile')}
                  </Text>
                ) : null}
              </View>
              <View style={styles.meta}>
                {!item.isRead ? <View style={styles.unreadDot} /> : null}
                <Text style={styles.time}>
                  {formatTime(item.createdAt ?? item.time)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  back: {
    width: 44,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: fontSize(18),
    fontWeight: '800',
  },
  spacer: {
    width: 44,
  },
  markAll: {
    minWidth: 44,
    paddingHorizontal: 4,
    alignItems: 'flex-end',
  },
  markAllText: {
    color: homeAccent.cyan,
    fontSize: fontSize(11),
    fontWeight: '700',
  },
  filterScroller: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filters: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    alignItems: 'center',
  },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: palette.gray900,
    borderWidth: 1,
    borderColor: palette.gray750,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: homeAccent.yellow,
    borderColor: homeAccent.yellow,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    fontWeight: '700',
  },
  chipTextOn: {
    color: palette.black,
  },
  list: {
    paddingTop: 4,
    paddingBottom: 40,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowUnread: {
    backgroundColor: '#141414',
  },
  pressed: {
    backgroundColor: '#111111',
  },
  avatarWrap: {
    width: 52,
    height: 52,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.gray800,
  },
  kindBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: palette.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(15),
    fontWeight: '700',
  },
  rowBody: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    lineHeight: 18,
  },
  cta: {
    color: homeAccent.cyan,
    fontSize: fontSize(12),
    fontWeight: '700',
    marginTop: 2,
  },
  meta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: homeAccent.cyan,
  },
  time: {
    color: colors.textMuted,
    fontSize: fontSize(11),
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 8,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.gray900,
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
