import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PROFILE_RULES } from '@/config/constants';
import {
  useDeletePhotoMutation,
  useGetMyProfileQuery,
} from '@/features/profile/api/profileApi';
import { usePhotoUpload } from '@/features/profile/hooks/usePhotoUpload';
import { Icon, ScreenContainer } from '@/shared/components';
import type { Photo } from '@/shared/types/api';
import { showErrorAlert } from '@/shared/utils/alerts';
import { colors, screen } from '@/theme';

import { OnboardingNextButton } from '../components/OnboardingNextButton';
import { PhotoSlot } from '../components/PhotoSlot';
import { TitleBar } from '../components/TitleBar';
import { useOnboardingNavigation } from '../hooks/useOnboardingNavigation';

const SLOT_SIZE = (screen.width - 40) / 2 - 10;
const TIP_KEYS = ['tipQuality', 'tipFace', 'tipReal', 'tipGroup'] as const;

export function PhotosScreen() {
  const { t } = useTranslation();
  const { goToNextStep } = useOnboardingNavigation();
  const { data: profile } = useGetMyProfileQuery();
  const [deletePhoto] = useDeletePhotoMutation();
  const { pickAndUpload, pickAndUploadMany } = usePhotoUpload();
  const [busySlot, setBusySlot] = useState<number | null>(null);

  const photos = [...(profile?.photos ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const uploadedCount = photos.length;
  const hasMinimum = uploadedCount >= PROFILE_RULES.minPhotos;

  const runInSlot = async (slot: number, task: () => Promise<unknown>) => {
    setBusySlot(slot);
    try {
      await task();
    } catch (error) {
      showErrorAlert(error);
    } finally {
      setBusySlot(null);
    }
  };

  const replacePhoto = (slot: number, photo: Photo) =>
    runInSlot(slot, async () => {
      const uploaded = await pickAndUpload('library');
      if (uploaded) {
        await deletePhoto(photo.id).unwrap();
      }
    });

  const removePhoto = (slot: number, photo: Photo) =>
    runInSlot(slot, () => deletePhoto(photo.id).unwrap());

  const handleSlotPress = (slot: number) => {
    const photo = photos[slot];
    if (!photo) {
      runInSlot(slot, () =>
        pickAndUploadMany(
          'library',
          PROFILE_RULES.maxPhotos - photos.length,
        ),
      );
      return;
    }
    Alert.alert(
      t('onboarding.photos.manageTitle'),
      t('onboarding.photos.manageMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('onboarding.photos.replace'),
          onPress: () => replacePhoto(slot, photo),
        },
        {
          text: t('onboarding.photos.remove'),
          style: 'destructive',
          onPress: () => removePhoto(slot, photo),
        },
      ],
    );
  };

  const handleNext = () => {
    if (!hasMinimum) {
      Alert.alert(
        t('onboarding.photos.minRequiredTitle'),
        t('onboarding.photos.minRequired', {
          min: PROFILE_RULES.minPhotos,
          count: uploadedCount,
        }),
      );
      return;
    }
    goToNextStep();
  };

  return (
    <ScreenContainer style={styles.container}>
      <TitleBar title={t('onboarding.photos.title')} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.description}>
          {t('onboarding.photos.description', { max: PROFILE_RULES.maxPhotos })}
          <Text style={styles.requiredHighlight}>
            {t('onboarding.photos.descriptionRequired', {
              min: PROFILE_RULES.minPhotos,
            })}
          </Text>
          {t('onboarding.photos.descriptionTail')}
        </Text>

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
          {Array.from({ length: PROFILE_RULES.maxPhotos }, (_, slot) => (
            <PhotoSlot
              key={photos[slot]?.id ?? `empty-${slot}`}
              photo={photos[slot]}
              size={SLOT_SIZE}
              isRequired={slot < PROFILE_RULES.minPhotos}
              isUploading={busySlot === slot}
              isLocked={busySlot !== null && busySlot !== slot}
              onPress={() => handleSlotPress(slot)}
            />
          ))}
        </View>

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>
            {t('onboarding.photos.tipsTitle')}
          </Text>
          {TIP_KEYS.map(key => (
            <View key={key} style={styles.tip}>
              <Icon name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.tipText}>
                {t(`onboarding.photos.${key}`)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <OnboardingNextButton
          onPress={handleNext}
          ready={busySlot === null}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  requiredHighlight: {
    color: colors.accent,
    fontWeight: 'bold',
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
    fontSize: 14,
    fontWeight: '600',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    gap: 8,
  },
  counterText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tips: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  tipsTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  tipText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
});
