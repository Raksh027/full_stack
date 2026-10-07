import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { GENDER_OPTIONS } from '@/features/profile/constants/profileOptions';
import type { Gender } from '@/features/profile/types';
import { BackButton, ScreenContainer } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

import { OnboardingNextButton } from '../components/OnboardingNextButton';
import { PermanentFieldWarning } from '../components/PermanentFieldWarning';
import { RadioOption } from '../components/RadioOption';
import { useProfileStep } from '../hooks/useProfileStep';

export function GenderScreen() {
  const { t } = useTranslation();
  const { profile, isSaving, saveAndContinue } = useProfileStep();
  const [gender, setGender] = useState<Gender | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (profile?.gender) {
      setGender(profile.gender);
    }
  }, [profile?.gender]);

  const handleNext = () => {
    if (!gender) {
      return;
    }
    saveAndContinue({ gender });
  };

  return (
    <ScreenContainer style={styles.container}>
      <BackButton style={styles.backButton} />

      <View style={styles.content}>
        <Text style={styles.title}>{t('onboarding.gender.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.gender.subtitle')}</Text>

        <View accessibilityRole="radiogroup" style={styles.options}>
          {GENDER_OPTIONS.map(option => (
            <RadioOption
              key={option.value}
              label={t(`profileOptions.gender.${option.value}`)}
              hint={
                option.value === 'nonbinary'
                  ? t('onboarding.gender.nonbinaryHint')
                  : undefined
              }
              selected={gender === option.value}
              onPress={() => {
                setGender(option.value);
                setShowWarning(true);
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        {!gender ? (
          <Text style={styles.selectHint}>
            {t('onboarding.gender.selectHint')}
          </Text>
        ) : null}
        <OnboardingNextButton
          onPress={handleNext}
          ready={Boolean(gender)}
          loading={isSaving}
        />
      </View>

      <PermanentFieldWarning
        visible={showWarning}
        title={t('onboarding.basicInfo.genderWarningTitle')}
        message={t('onboarding.basicInfo.genderWarningMessage')}
        confirmLabel={t('onboarding.basicInfo.warningGotIt')}
        onConfirm={() => setShowWarning(false)}
      />
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
    marginBottom: 20,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: fontSize(32),
    lineHeight: 38,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 28,
    fontSize: fontSize(15),
    lineHeight: 22,
    color: colors.textSecondary,
  },
  options: {
    gap: 12,
  },
  footer: {
    paddingBottom: 8,
    gap: 12,
  },
  selectHint: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: fontSize(13),
  },
});
