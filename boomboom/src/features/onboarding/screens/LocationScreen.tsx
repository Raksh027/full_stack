import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import {
  useGetMyProfileQuery,
  useUpdateLocationMutation,
} from '@/features/profile/api/profileApi';
import {
  getDeviceLocation,
  LocationError,
  type LocationErrorReason,
} from '@/services/location/deviceLocation';
import {
  Icon,
  PrimaryButton,
  ScreenContainer,
} from '@/shared/components';
import type { IconName } from '@/shared/components';
import { showErrorAlert } from '@/shared/utils/alerts';
import { colors } from '@/theme';

import { OnboardingNextButton } from '../components/OnboardingNextButton';
import { useOnboardingNavigation } from '../hooks/useOnboardingNavigation';

const ERROR_KEYS = {
  denied: 'onboarding.location.errorDenied',
  unavailable: 'onboarding.location.errorUnavailable',
  timeout: 'onboarding.location.errorTimeout',
  unknown: 'onboarding.location.errorGeneric',
} as const satisfies Record<LocationErrorReason, string>;

const FEATURES: {
  icon: IconName;
  key: 'featureNearby' | 'featurePrivacy' | 'featureConnections';
}[] = [
  { icon: 'people', key: 'featureNearby' },
  { icon: 'shield-checkmark', key: 'featurePrivacy' },
  { icon: 'locate', key: 'featureConnections' },
];

const entering = ZoomIn.springify().damping(14);

export function LocationScreen() {
  const { t, i18n } = useTranslation();
  const { goToNextStep } = useOnboardingNavigation();
  const { data: profile } = useGetMyProfileQuery();
  const [updateLocation, { isLoading: isSaving }] = useUpdateLocationMutation();
  const [isLocating, setIsLocating] = useState(false);
  const [errorReason, setErrorReason] = useState<LocationErrorReason | null>(
    null,
  );
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const hasLocation = Boolean(updatedAt || profile?.city);
  const isBusy = isLocating || isSaving;

  const handleEnableLocation = async () => {
    setErrorReason(null);
    setIsLocating(true);
    try {
      const coords = await getDeviceLocation();
      await updateLocation(coords).unwrap();
      setUpdatedAt(new Date());
    } catch (error) {
      if (error instanceof LocationError) {
        setErrorReason(error.reason);
      } else {
        showErrorAlert(error);
      }
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Animated.View entering={entering} style={styles.header}>
          <View style={styles.iconCircle}>
            <Icon name="location" size={36} />
          </View>
          <Text style={styles.title}>{t('onboarding.location.title')}</Text>
          <Text style={styles.subtitle}>
            {t('onboarding.location.subtitle')}
          </Text>
        </Animated.View>

        {hasLocation ? (
          <Animated.View entering={entering} style={styles.locationCard}>
            <View style={styles.successBadge}>
              <Icon name="checkmark-circle" size={24} />
            </View>
            <View style={styles.locationRow}>
              <Icon name="location-sharp" size={18} />
              <Text style={styles.cityText}>
                {profile?.city ?? t('onboarding.location.unknownCity')}
              </Text>
            </View>
            <View style={styles.locationRow}>
              <Icon name="earth" size={18} color={colors.textSecondary} />
              <Text style={styles.countryText}>
                {profile?.country ?? t('onboarding.location.unknownCountry')}
              </Text>
            </View>

            {updatedAt ? (
              <>
                <View style={styles.divider} />
                <View style={styles.timestampRow}>
                  <Icon
                    name="time-outline"
                    size={14}
                    color={colors.textMuted}
                  />
                  <Text style={styles.timestamp}>
                    {t('onboarding.location.updatedAt', {
                      time: updatedAt.toLocaleString(i18n.language),
                    })}
                  </Text>
                </View>
              </>
            ) : null}

            <PrimaryButton
              label={t('onboarding.location.update')}
              icon="refresh"
              onPress={handleEnableLocation}
              loading={isBusy}
              shape="rounded"
              style={styles.updateButton}
            />
          </Animated.View>
        ) : (
          <Animated.View entering={entering} style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Icon
                name="location-outline"
                size={40}
                color={colors.textDisabled}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {t('onboarding.location.emptyTitle')}
            </Text>
            <Text style={styles.emptyText}>
              {t('onboarding.location.emptyText')}
            </Text>
          </Animated.View>
        )}

        {errorReason ? (
          <Animated.View entering={FadeIn} style={styles.errorCard}>
            <Icon name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{t(ERROR_KEYS[errorReason])}</Text>
          </Animated.View>
        ) : null}

        {!hasLocation ? (
          <Animated.View entering={FadeIn} style={styles.features}>
            {FEATURES.map(feature => (
              <View key={feature.key} style={styles.featureItem}>
                <Icon name={feature.icon} size={18} />
                <Text style={styles.featureText}>
                  {t(`onboarding.location.${feature.key}`)}
                </Text>
              </View>
            ))}
          </Animated.View>
        ) : null}

        <View style={styles.spacer} />

        {!hasLocation ? (
          <PrimaryButton
            label={t('onboarding.location.enable')}
            icon="location"
            onPress={handleEnableLocation}
            loading={isBusy}
            shape="rounded"
          />
        ) : null}
      </View>

      {hasLocation ? (
        <View style={styles.cta}>
          <OnboardingNextButton onPress={goToNextStep} />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 40,
    paddingBottom: 100,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  locationCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  successBadge: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  cityText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  countryText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  timestamp: {
    color: colors.textMuted,
    fontSize: 12,
  },
  updateButton: {
    marginTop: 14,
    height: 44,
  },
  emptyCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorCard: {
    flexDirection: 'row',
    backgroundColor: colors.dangerSurface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  features: {
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  spacer: {
    flex: 1,
  },
  cta: {
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
});
