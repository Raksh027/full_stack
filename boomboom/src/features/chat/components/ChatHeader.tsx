import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { images } from '@/assets';
import { Icon } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { chatAccent } from '../theme';

type Props = {
  name: string;
  photo?: string;
  age?: number;
  genderLabel?: string | null;
  city?: string | null;
  flag?: string;
  flagUrl?: string;
  verified?: boolean;
  distanceKm?: number | null;
  statusLabel: string;
  statusOnline?: boolean;
  onBack: () => void;
  onOpenProfile: () => void;
  onMore: () => void;
};

export function ChatHeader({
  name,
  photo,
  age,
  genderLabel,
  city,
  flag,
  flagUrl,
  verified,
  distanceKm,
  statusLabel,
  statusOnline,
  onBack,
  onOpenProfile,
  onMore,
}: Props) {
  const meta = [age, genderLabel, city].filter(Boolean).join(' • ');

  return (
    <View style={styles.wrap}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.side}>
        <Icon name="chevron-back" size={22} color={colors.textPrimary} />
      </Pressable>

      <Pressable style={styles.card} onPress={onOpenProfile}>
        <Image
          source={photo ? { uri: photo } : images.profilePlaceholder}
          style={styles.avatar}
        />
        <View style={styles.copy}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {verified ? (
              <Icon name="checkmark-circle" size={15} color={chatAccent.blue} />
            ) : null}
          </View>
          {meta || flagUrl || flag ? (
            <View style={styles.metaRow}>
              {meta ? (
                <Text style={styles.meta} numberOfLines={1}>
                  {meta}
                </Text>
              ) : null}
              {flagUrl ? (
                <Image source={{ uri: flagUrl }} style={styles.flagImage} />
              ) : flag ? (
                <Text style={styles.meta}>{flag}</Text>
              ) : null}
            </View>
          ) : null}
          <View style={styles.chips}>
            {distanceKm != null ? (
              <View style={styles.chip}>
                <Icon name="location" size={10} color={colors.textSecondary} />
                <Text style={styles.chipText}>{distanceKm} km</Text>
              </View>
            ) : null}
            <View style={styles.chip}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: statusOnline ? colors.success : palette.gray400 },
                ]}
              />
              <Text style={styles.chipText}>{statusLabel}</Text>
            </View>
          </View>
        </View>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={onMore} style={styles.side}>
        <Icon name="ellipsis-horizontal" size={18} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 4,
  },
  side: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 28,
    backgroundColor: chatAccent.card,
    borderWidth: 1,
    borderColor: palette.gray850,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.gray750,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flagImage: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  name: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '800',
    maxWidth: '84%',
  },
  meta: {
    color: colors.textSecondary,
    fontSize: fontSize(12),
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#1C1C1C',
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fontSize(10),
    fontWeight: '600',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
