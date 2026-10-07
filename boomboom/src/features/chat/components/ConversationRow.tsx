import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { images } from '@/assets';
import { homeAccent } from '@/features/discovery/theme';
import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import type { Conversation } from '../types';
import { formatInboxTime } from '../utils/formatInboxTime';

type Props = {
  conversation: Conversation;
  preview: string;
  isOnline: boolean;
  isMine: boolean;
  showRequestActions?: boolean;
  onPress: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
};

export function ConversationRow({
  conversation,
  preview,
  isOnline,
  isMine,
  showRequestActions = false,
  onPress,
  onAccept,
  onDecline,
}: Props) {
  const { t } = useTranslation();
  const unread = conversation.unreadCount > 0;
  const photo = conversation.user.photos?.[0]?.url;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.avatarRing, isOnline && styles.avatarOnline]}>
        <Image
          source={photo ? { uri: photo } : images.profilePlaceholder}
          style={styles.avatar}
        />
        {isOnline ? <View style={styles.onlineDot} /> : null}
      </View>

      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, unread && styles.nameUnread]}
            numberOfLines={1}
          >
            {conversation.user.name}
          </Text>
          {conversation.user.isVerified ? (
            <Icon name="checkmark-circle" size={14} color={homeAccent.cyan} />
          ) : null}
        </View>
        <Text
          style={[styles.preview, unread && styles.previewUnread]}
          numberOfLines={1}
        >
          {isMine ? `You: ${preview}` : preview}
        </Text>
      </View>

      {showRequestActions ? (
        <View style={styles.requestMeta}>
          <Text style={styles.time}>
            {formatInboxTime(conversation.updatedAt)}
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('chat.decline')}
              onPress={() => onDecline?.()}
              style={styles.action}
            >
              <View style={styles.declineBtn}>
                <Icon name="close" size={20} color={palette.white} />
              </View>
              <Text style={styles.actionLabel}>{t('chat.decline')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('chat.accept')}
              onPress={() => onAccept?.()}
              style={styles.action}
            >
              <View style={styles.acceptBtn}>
                <Icon name="checkmark" size={20} color={palette.white} />
              </View>
              <Text style={styles.actionLabel}>{t('chat.accept')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.meta}>
          <Text style={[styles.time, unread && styles.timeUnread]}>
            {formatInboxTime(conversation.updatedAt)}
          </Text>
          {unread ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
              </Text>
            </View>
          ) : conversation.lastMessage?.status === 'read' && isMine ? (
            <Icon name="checkmark-done" size={14} color={homeAccent.cyan} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pressed: {
    backgroundColor: '#111111',
  },
  avatarRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOnline: {
    borderColor: homeAccent.cyan,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: palette.gray750,
  },
  onlineDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '600',
    maxWidth: '86%',
  },
  nameUnread: {
    fontWeight: '800',
  },
  preview: {
    color: colors.textMuted,
    fontSize: fontSize(13),
  },
  previewUnread: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  meta: {
    alignItems: 'flex-end',
    gap: 8,
    minWidth: 44,
  },
  requestMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  time: {
    color: colors.textMuted,
    fontSize: fontSize(11),
    fontWeight: '600',
  },
  timeUnread: {
    color: homeAccent.yellow,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: homeAccent.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: palette.black,
    fontSize: 11,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  action: {
    alignItems: 'center',
    gap: 4,
    minWidth: 52,
  },
  declineBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#30D158',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: colors.textPrimary,
    fontSize: fontSize(11),
    fontWeight: '600',
  },
});
