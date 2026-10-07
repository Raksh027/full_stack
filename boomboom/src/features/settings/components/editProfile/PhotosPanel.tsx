import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PROFILE_RULES } from '@/config/constants';
import { PhotoSlot } from '@/features/onboarding/components/PhotoSlot';
import { Icon } from '@/shared/components';
import type { Photo } from '@/shared/types/api';
import { colors, fontSize, palette, screen } from '@/theme';

const SLOT_SIZE = (screen.width - 44) / 2 - 10;

type Props = {
  photos: Photo[];
  busySlot: number | null;
  onSlotPress: (slot: number) => void;
};

export function PhotosPanel({ photos, busySlot, onSlotPress }: Props) {
  const { t } = useTranslation();
  const uploadedCount = photos.length;
  const hasMinimum = uploadedCount >= PROFILE_RULES.minPhotos;
  const displayMax = Math.min(PROFILE_RULES.maxPhotos, 6);

  return (
    <View style={styles.wrap}>
      {busySlot !== null ? (
        <View style={styles.banner}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.bannerText}>
            {t('onboarding.photos.uploadingBanner')}
          </Text>
        </View>
      ) : null}

      <View style={styles.counter}>
        <Text style={styles.counterText}>
          {t('onboarding.photos.counter', {
            count: Math.min(uploadedCount, PROFILE_RULES.minPhotos),
            min: PROFILE_RULES.minPhotos,
          })}
        </Text>
        {hasMinimum ? (
          <Icon name="checkmark-circle" size={20} color={colors.success} />
        ) : null}
      </View>

      <View style={styles.grid}>
        {Array.from({ length: displayMax }, (_, slot) => (
          <PhotoSlot
            key={photos[slot]?.id ?? `empty-${slot}`}
            photo={photos[slot]}
            size={SLOT_SIZE}
            isRequired={slot < PROFILE_RULES.minPhotos}
            isUploading={busySlot === slot}
            isLocked={busySlot !== null && busySlot !== slot}
            onPress={() => onSlotPress(slot)}
          />
        ))}
      </View>
    </View>
  );
}

export function confirmPhotoSlotAction(
  labels: {
    title: string;
    message: string;
    cancel: string;
    replace: string;
    remove: string;
  },
  handlers: {
    onReplace: () => void;
    onRemove: () => void;
  },
) {
  Alert.alert(labels.title, labels.message, [
    { text: labels.cancel, style: 'cancel' },
    {
      text: labels.replace,
      onPress: handlers.onReplace,
    },
    {
      text: labels.remove,
      style: 'destructive',
      onPress: handlers.onRemove,
    },
  ]);
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2C2E',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  bannerText: {
    color: colors.accent,
    fontSize: fontSize(14),
    fontWeight: '600',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: palette.gray900,
    borderRadius: 999,
    gap: 8,
  },
  counterText: {
    color: colors.textSecondary,
    fontSize: fontSize(13),
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
