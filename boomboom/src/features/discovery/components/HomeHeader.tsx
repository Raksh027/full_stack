import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { PreferenceIcon } from './PreferenceIcon';

type Props = {
  city: string;
  flagUrl?: string;
  fetching?: boolean;
  avatarUrl?: string | null;
  unreadCount?: number;
  onPressLocation?: () => void;
  onPressAvatar?: () => void;
  onPressAlerts?: () => void;
  onPressFilters?: () => void;
};

export function HomeHeader({
  city,
  flagUrl,
  fetching = false,
  unreadCount = 0,
  onPressLocation,
  onPressAvatar,
  onPressAlerts,
  onPressFilters,
}: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.identity}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={onPressAvatar}
          style={styles.flag}
        >
          {flagUrl ? (
            <Image source={{ uri: flagUrl }} style={styles.flagImage} />
          ) : (
            <Icon name="flag-outline" size={16} color={colors.textPrimary} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search current location"
          disabled={fetching}
          onPress={onPressLocation}
          hitSlop={10}
          style={styles.place}
        >
          {fetching ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : null}
          <Text style={styles.city} numberOfLines={1}>
            {city}
          </Text>
          <Icon name="chevron-down" size={16} color={colors.textPrimary} />
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          hitSlop={8}
          onPress={onPressAlerts}
          style={styles.iconHit}
        >
          <Icon
            name="notifications-outline"
            size={18}
            color={colors.textPrimary}
          />
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Preferences"
          hitSlop={8}
          onPress={onPressFilters}
          style={styles.iconHit}
        >
          <PreferenceIcon size={18} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  flag: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.gray850,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  flagImage: {
    width: 28,
    height: 28,
  },
  city: {
    color: colors.textPrimary,
    fontSize: fontSize(18),
    fontWeight: '700',
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconHit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.gray850,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: '#FF4D6A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: palette.white,
    fontSize: 9,
    fontWeight: '800',
  },
});
