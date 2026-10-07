import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PROFILE_RULES } from '@/config/constants';
import { GradientOutline, Icon } from '@/shared/components';
import type { Photo } from '@/shared/types/api';
import { colors, fontSize } from '@/theme';

type Props = {
  photos: Photo[];
  onAdd: () => void;
  onRemove: (photo: Photo) => void;
};

const THUMB = 72;

export function PhotoThumbnails({ photos, onAdd, onRemove }: Props) {
  const { t } = useTranslation();
  const slotCount = Math.max(PROFILE_RULES.minPhotos, photos.length);
  const hasMinimum = photos.length >= PROFILE_RULES.minPhotos;

  return (
    <View style={styles.wrap}>
      <Text style={styles.counter}>
        {t(
          hasMinimum
            ? 'onboarding.basicInfo.photoCounterDone'
            : 'onboarding.basicInfo.photoCounter',
          { count: photos.length, min: PROFILE_RULES.minPhotos },
        )}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {Array.from({ length: slotCount }, (_, index) => {
          const photo = photos[index];
          if (photo) {
            return (
              <GradientOutline
                key={photo.id}
                radius={14}
                style={styles.thumbWrap}
                innerStyle={styles.thumbInner}
              >
                <Image source={{ uri: photo.url }} style={styles.image} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  hitSlop={8}
                  onPress={() => onRemove(photo)}
                  style={({ pressed }) => [
                    styles.remove,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="close" size={12} color={colors.textPrimary} />
                </Pressable>
                <View style={styles.check}>
                  <Icon
                    name="checkmark-circle"
                    size={16}
                    color={colors.success}
                  />
                </View>
              </GradientOutline>
            );
          }

          return (
            <Pressable
              key={`empty-${index}`}
              accessibilityRole="button"
              accessibilityLabel="Add photo"
              onPress={onAdd}
              style={({ pressed }) => [
                styles.emptySlot,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="add" size={22} color={colors.textMuted} />
              <Text style={styles.emptyLabel}>
                {t(
                  index < PROFILE_RULES.minPhotos
                    ? 'onboarding.basicInfo.photoSlotRequired'
                    : 'onboarding.basicInfo.photoSlotAdd',
                )}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 10,
  },
  counter: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: fontSize(13),
  },
  row: {
    gap: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
    flexGrow: 1,
  },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
  },
  thumbInner: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  emptySlot: {
    width: THUMB,
    height: THUMB,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  emptyLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  remove: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    top: 3,
    right: 3,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
});
