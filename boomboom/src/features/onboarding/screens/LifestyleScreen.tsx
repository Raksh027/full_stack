import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PROFILE_RULES } from '@/config/constants';
import {
  useCompleteOnboardingMutation,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
} from '@/features/profile/api/profileApi';
import {
  INTEREST_OPTIONS,
  LANGUAGE_OPTIONS,
  LIFESTYLE_OPTIONS,
  WORK_OPTIONS,
  lifestyleLabelKey,
} from '@/features/profile/constants/profileOptions';
import type {
  Drinking,
  Lifestyle,
  WorkCategory,
  WorkoutFrequency,
} from '@/features/profile/types';
import {
  BackButton,
  Icon,
  ScreenContainer,
  type IconName,
} from '@/shared/components';
import { showErrorAlert } from '@/shared/utils/alerts';
import { colors, fontSize, palette } from '@/theme';

import { Chip } from '../components/Chip';
import { HeightSlider } from '../components/HeightSlider';
import { LifestyleChoice } from '../components/LifestyleChoice';
import { OnboardingNextButton } from '../components/OnboardingNextButton';

const DEFAULT_HEIGHT_CM = 175;
const ACCENT = '#F5C400';
const CYAN = '#2EE6D6';

const DRINKING_OPTIONS = [
  'non_drinker',
  'social',
  'occasional',
  'regular',
] as const satisfies readonly Drinking[];

const WORKOUT_OPTIONS = [
  'never',
  'sometimes',
  'regular',
  'enthusiast',
] as const satisfies readonly WorkoutFrequency[];

type SectionHeaderProps = {
  title: string;
  hint: string;
  complete: boolean;
  icon: IconName;
  accent: string;
};

function SectionHeader({
  title,
  hint,
  complete,
  icon,
  accent,
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { borderColor: accent }]}>
        <Icon name={icon} size={16} color={accent} />
      </View>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionHint}>{hint}</Text>
      </View>
      {complete ? (
        <Icon name="checkmark-circle" size={20} color={colors.success} />
      ) : (
        <View style={styles.pendingDot} />
      )}
    </View>
  );
}

export function LifestyleScreen() {
  const { t } = useTranslation();
  const { data: profile } = useGetMyProfileQuery();
  const [updateProfile, { isLoading: isSaving }] = useUpdateMyProfileMutation();
  const [completeOnboarding, { isLoading: isCompleting }] =
    useCompleteOnboardingMutation();
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [workCategory, setWorkCategory] = useState<WorkCategory | null>(null);
  const [bodyType, setBodyType] = useState<Lifestyle['bodyType']>(null);
  const [heightCm, setHeightCm] = useState(DEFAULT_HEIGHT_CM);
  const [drinking, setDrinking] = useState<Lifestyle['drinking']>(null);
  const [workout, setWorkout] = useState<Lifestyle['workout']>(null);
  const [personality, setPersonality] =
    useState<Lifestyle['personality']>(null);
  const [hitInterestLimit, setHitInterestLimit] = useState(false);
  const isBusy = isSaving || isCompleting;

  useEffect(() => {
    if (!profile) {
      return;
    }
    const removedInterests = new Set(['cooking', 'food', 'wine', 'reading', 'pets']);
    setInterests(
      profile.interests
        .filter(item => !removedInterests.has(item))
        .map(item => (item === 'art' ? 'party' : item)),
    );
    setLanguages(profile.languages ?? []);
    setWorkCategory(
      profile.workCategory &&
        WORK_OPTIONS.some(option => option.value === profile.workCategory)
        ? profile.workCategory
        : null,
    );
    setBodyType(profile.lifestyle.bodyType);
    setHeightCm(profile.heightCm ?? DEFAULT_HEIGHT_CM);
    setDrinking(profile.lifestyle.drinking);
    setWorkout(profile.lifestyle.workout);
    setPersonality(profile.lifestyle.personality);
  }, [profile]);

  const remainingInterests = Math.max(
    0,
    PROFILE_RULES.minInterests - interests.length,
  );
  const interestsValid = interests.length >= PROFILE_RULES.minInterests;
  const checks = [
    interestsValid,
    Boolean(bodyType),
    Boolean(drinking),
    Boolean(workout),
    Boolean(personality),
  ];
  const doneCount = checks.filter(Boolean).length;
  const isComplete = checks.every(Boolean);
  const canSubmit = isComplete && !isBusy;
  const interestRatio = Math.min(
    1,
    interests.length / PROFILE_RULES.minInterests,
  );

  const toggleInterest = (value: string) => {
    setInterests(current => {
      if (current.includes(value)) {
        setHitInterestLimit(false);
        return current.filter(item => item !== value);
      }
      if (current.length >= PROFILE_RULES.maxInterests) {
        setHitInterestLimit(true);
        return current;
      }
      setHitInterestLimit(false);
      return [...current, value];
    });
  };

  const toggleLanguage = (value: string) => {
    setLanguages(current =>
      current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value],
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }
    try {
      await updateProfile({
        interests,
        languages,
        workCategory,
        heightCm,
        lifestyle: { bodyType, drinking, workout, personality },
      }).unwrap();
      await completeOnboarding().unwrap();
    } catch (error) {
      showErrorAlert(error);
    }
  };

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.glow} />
      {Platform.OS === 'ios' ? (
        <BackButton style={styles.backButton} />
      ) : (
        <View style={styles.androidTop} />
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.kickerRow}>
          <View style={styles.kickerPill}>
            <Icon name="sparkles" size={12} color={ACCENT} />
            <Text style={styles.kicker}>{t('onboarding.lifestyle.header')}</Text>
          </View>
          <Text style={styles.stepCount}>
            {t('onboarding.lifestyle.progress', {
              done: doneCount,
              total: checks.length,
            })}
          </Text>
        </View>

        <View style={styles.dots}>
          {checks.map((done, index) => (
            <View
              key={index}
              style={[styles.dot, done ? styles.dotOn : styles.dotOff]}
            />
          ))}
        </View>

        <Text style={styles.title}>{t('onboarding.lifestyle.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.lifestyle.subtitle')}</Text>

        <View style={styles.card}>
          <SectionHeader
            title={t('profileOptions.interests.title')}
            hint={t('onboarding.lifestyle.selectAtLeast', {
              min: PROFILE_RULES.minInterests,
            })}
            complete={interestsValid}
            icon="sparkles-outline"
            accent={ACCENT}
          />
          <View style={styles.chips}>
            {INTEREST_OPTIONS.map(option => (
              <Chip
                key={option.value}
                label={t(`profileOptions.interests.options.${option.value}`)}
                icon={option.icon}
                selected={interests.includes(option.value)}
                onPress={() => toggleInterest(option.value)}
                disabled={isBusy}
              />
            ))}
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${interestRatio * 100}%` }]}
            />
          </View>
          <Text
            style={[
              styles.progressText,
              interestsValid && styles.progressDone,
              hitInterestLimit && styles.progressWarn,
            ]}
          >
            {hitInterestLimit
              ? t('onboarding.lifestyle.interestLimit')
              : interestsValid
                ? t('onboarding.lifestyle.interestDone', {
                    count: interests.length,
                  })
                : t('onboarding.lifestyle.interestProgress', {
                    count: interests.length,
                    min: PROFILE_RULES.minInterests,
                    remaining: remainingInterests,
                  })}
          </Text>
        </View>

        <View style={styles.card}>
          <SectionHeader
            title={t('profileOptions.languages.title')}
            hint={t('onboarding.lifestyle.selectLanguages')}
            complete={languages.length > 0}
            icon="language-outline"
            accent={CYAN}
          />
          <View style={styles.chips}>
            {LANGUAGE_OPTIONS.map(option => (
              <Chip
                key={option.value}
                label={t(`profileOptions.languages.options.${option.value}`)}
                emoji={option.emoji}
                selected={languages.includes(option.value)}
                onPress={() => toggleLanguage(option.value)}
                disabled={isBusy}
              />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <SectionHeader
            title={t('profileOptions.work.title')}
            hint={t('onboarding.lifestyle.selectWork')}
            complete={Boolean(workCategory)}
            icon="briefcase-outline"
            accent={CYAN}
          />
          <View style={styles.chips}>
            {WORK_OPTIONS.map(option => (
              <Chip
                key={option.value}
                label={t(`profileOptions.work.options.${option.value}`)}
                icon={option.icon}
                selected={workCategory === option.value}
                onPress={() =>
                  setWorkCategory(current =>
                    current === option.value ? null : option.value,
                  )
                }
                disabled={isBusy}
              />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <SectionHeader
            title={t('profileOptions.lifestyle.bodyType.title')}
            hint={t('onboarding.lifestyle.selectOne')}
            complete={Boolean(bodyType)}
            icon="body-outline"
            accent={CYAN}
          />
          <View style={styles.grid}>
            {LIFESTYLE_OPTIONS.bodyType.map(option => (
              <LifestyleChoice
                key={option.value}
                label={t(lifestyleLabelKey('bodyType', option.value))}
                icon={option.icon}
                selected={bodyType === option.value}
                onPress={() =>
                  setBodyType(current =>
                    current === option.value ? null : option.value,
                  )
                }
                disabled={isBusy}
              />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <SectionHeader
            title={t('profileOptions.lifestyle.heightRange.title')}
            hint={t('onboarding.lifestyle.cmValue', { value: heightCm })}
            complete
            icon="resize-outline"
            accent="#6E5CFF"
          />
          <HeightSlider valueCm={heightCm} onChange={setHeightCm} />
        </View>

        <View style={styles.card}>
          <SectionHeader
            title={t('profileOptions.lifestyle.drinking.title')}
            hint={t('onboarding.lifestyle.selectOne')}
            complete={Boolean(drinking)}
            icon="wine-outline"
            accent={ACCENT}
          />
          <View style={styles.grid}>
            {DRINKING_OPTIONS.map(value => (
              <LifestyleChoice
                key={value}
                label={t(lifestyleLabelKey('drinking', value))}
                icon={
                  LIFESTYLE_OPTIONS.drinking.find(item => item.value === value)
                    ?.icon
                }
                selected={drinking === value}
                onPress={() =>
                  setDrinking(current => (current === value ? null : value))
                }
                disabled={isBusy}
              />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <SectionHeader
            title={t('profileOptions.lifestyle.personality.title')}
            hint={t('onboarding.lifestyle.selectOne')}
            complete={Boolean(personality)}
            icon="happy-outline"
            accent="#6E5CFF"
          />
          <View style={styles.grid}>
            {LIFESTYLE_OPTIONS.personality.map(option => (
              <LifestyleChoice
                key={option.value}
                label={t(lifestyleLabelKey('personality', option.value))}
                icon={option.icon}
                selected={personality === option.value}
                onPress={() =>
                  setPersonality(current =>
                    current === option.value ? null : option.value,
                  )
                }
                disabled={isBusy}
              />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <SectionHeader
            title={t('profileOptions.lifestyle.workout.title')}
            hint={t('onboarding.lifestyle.selectOne')}
            complete={Boolean(workout)}
            icon="barbell-outline"
            accent={CYAN}
          />
          <View style={styles.grid}>
            {WORKOUT_OPTIONS.map(value => (
              <LifestyleChoice
                key={value}
                label={t(lifestyleLabelKey('workout', value))}
                icon={
                  LIFESTYLE_OPTIONS.workout.find(item => item.value === value)
                    ?.icon
                }
                selected={workout === value}
                onPress={() =>
                  setWorkout(current => (current === value ? null : value))
                }
                disabled={isBusy}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={[styles.footerHint, isComplete && styles.footerReady]}>
          {isComplete
            ? t('onboarding.lifestyle.readyHint')
            : t('onboarding.lifestyle.fillHint')}
        </Text>
        <OnboardingNextButton
          onPress={handleSubmit}
          ready={isComplete}
          loading={isBusy}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 22,
  },
  glow: {
    position: 'absolute',
    top: -40,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(245, 196, 0, 0.1)',
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
  androidTop: {
    height: 8,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 20,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  kickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#1A1600',
    borderWidth: 1,
    borderColor: ACCENT,
  },
  kicker: {
    color: ACCENT,
    fontSize: fontSize(12),
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  stepCount: {
    color: colors.textMuted,
    fontSize: fontSize(12),
    fontWeight: '600',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    height: 4,
    flex: 1,
    borderRadius: 2,
  },
  dotOn: {
    backgroundColor: ACCENT,
  },
  dotOff: {
    backgroundColor: palette.gray750,
  },
  title: {
    fontSize: fontSize(32),
    lineHeight: 38,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 22,
    fontSize: fontSize(15),
    lineHeight: 22,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: '#111111',
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.gray850,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCopy: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: fontSize(12),
  },
  pendingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: palette.gray600,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.gray750,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 2,
  },
  progressText: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: fontSize(13),
  },
  progressDone: {
    color: colors.success,
  },
  progressWarn: {
    color: colors.textSecondary,
  },
  footer: {
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
  },
  footerHint: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSize(13),
  },
  footerReady: {
    color: colors.success,
  },
});
