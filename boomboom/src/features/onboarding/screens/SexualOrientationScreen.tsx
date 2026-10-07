import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ORIENTATION_OPTIONS } from '@/features/profile/constants/profileOptions';
import type { SexualOrientation } from '@/features/profile/types';
import { BackButton, ScreenContainer } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { OnboardingNextButton } from '../components/OnboardingNextButton';
import { useProfileStep } from '../hooks/useProfileStep';

const PILL_BLUE = '#3AA0FF';

export function SexualOrientationScreen() {
  const { t } = useTranslation();
  const { profile, isSaving, saveAndContinue } = useProfileStep();
  const [orientation, setOrientation] = useState<SexualOrientation | null>(
    null,
  );

  useEffect(() => {
    if (profile?.sexualOrientation) {
      setOrientation(profile.sexualOrientation);
    }
  }, [profile?.sexualOrientation]);

  const handleNext = () => {
    if (!orientation) {
      return;
    }
    saveAndContinue({ sexualOrientation: orientation });
  };

  return (
    <ScreenContainer style={styles.container}>
      <BackButton style={styles.backButton} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('onboarding.orientation.title')}</Text>
        <Text style={styles.subtitle}>
          {t('onboarding.orientation.subtitle')}
        </Text>

        <View accessibilityRole="radiogroup" style={styles.list}>
          {ORIENTATION_OPTIONS.map(option => {
            const selected = orientation === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setOrientation(option.value)}
                style={({ pressed }) => [
                  styles.card,
                  selected && styles.cardOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cardTitle}>
                  {t(`profileOptions.orientation.${option.value}.title`)}
                </Text>
                <Text style={styles.cardDesc}>
                  {t(`profileOptions.orientation.${option.value}.description`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {!orientation ? (
          <Text style={styles.selectHint}>
            {t('onboarding.orientation.required')}
          </Text>
        ) : null}
        <OnboardingNextButton
          onPress={handleNext}
          ready={Boolean(orientation)}
          loading={isSaving}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 22,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.gray850,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    marginTop: 4,
    marginBottom: 12,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 16,
  },
  title: {
    fontSize: fontSize(28),
    lineHeight: 34,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: fontSize(14),
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: 18,
  },
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: palette.gray750,
    gap: 6,
  },
  cardOn: {
    borderColor: PILL_BLUE,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
  cardDesc: {
    color: colors.textMuted,
    fontSize: fontSize(13),
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.85,
  },
  footer: {
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
  },
  selectHint: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: fontSize(13),
  },
});
