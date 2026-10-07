import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/features/onboarding/components/Chip';
import { HeightSlider } from '@/features/onboarding/components/HeightSlider';
import { LifestyleChoice } from '@/features/onboarding/components/LifestyleChoice';
import { PROFILE_RULES } from '@/config/constants';
import { homeAccent } from '@/features/discovery/theme';
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
import { Icon, type IconName } from '@/shared/components';
import { colors, fontSize, palette } from '@/theme';

const ACCENT = homeAccent.yellow;
const CYAN = homeAccent.cyan;

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

type Props = {
  interests: string[];
  languages: string[];
  workCategory: WorkCategory | null;
  bodyType: Lifestyle['bodyType'];
  heightCm: number;
  drinking: Lifestyle['drinking'];
  workout: Lifestyle['workout'];
  personality: Lifestyle['personality'];
  onToggleInterest: (value: string) => void;
  onToggleLanguage: (value: string) => void;
  onWorkChange: (value: WorkCategory | null) => void;
  onBodyTypeChange: (value: Lifestyle['bodyType']) => void;
  onHeightChange: (value: number) => void;
  onDrinkingChange: (value: Lifestyle['drinking']) => void;
  onWorkoutChange: (value: Lifestyle['workout']) => void;
  onPersonalityChange: (value: Lifestyle['personality']) => void;
};

function SectionHeader({
  title,
  hint,
  complete,
  icon,
  accent,
}: {
  title: string;
  hint: string;
  complete: boolean;
  icon: IconName;
  accent: string;
}) {
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

export function LifestylePanel({
  interests,
  languages,
  workCategory,
  bodyType,
  heightCm,
  drinking,
  workout,
  personality,
  onToggleInterest,
  onToggleLanguage,
  onWorkChange,
  onBodyTypeChange,
  onHeightChange,
  onDrinkingChange,
  onWorkoutChange,
  onPersonalityChange,
}: Props) {
  const { t } = useTranslation();
  const interestsValid = interests.length >= PROFILE_RULES.minInterests;
  const remainingInterests = Math.max(
    0,
    PROFILE_RULES.minInterests - interests.length,
  );
  const checks = [
    interestsValid,
    Boolean(bodyType),
    Boolean(drinking),
    Boolean(workout),
    Boolean(personality),
  ];
  const isComplete = checks.every(Boolean);
  const interestRatio = Math.min(
    1,
    interests.length / PROFILE_RULES.minInterests,
  );

  return (
    <View style={styles.wrap}>
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
              onPress={() => onToggleInterest(option.value)}
            />
          ))}
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${interestRatio * 100}%` }]}
          />
        </View>
        <Text
          style={[styles.progressText, interestsValid && styles.progressDone]}
        >
          {interestsValid
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
              onPress={() => onToggleLanguage(option.value)}
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
                onWorkChange(
                  workCategory === option.value ? null : option.value,
                )
              }
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
                onBodyTypeChange(
                  bodyType === option.value ? null : option.value,
                )
              }
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
          accent={homeAccent.purple}
        />
        <HeightSlider valueCm={heightCm} onChange={onHeightChange} />
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
                onDrinkingChange(drinking === value ? null : value)
              }
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
          accent={homeAccent.purple}
        />
        <View style={styles.grid}>
          {LIFESTYLE_OPTIONS.personality.map(option => (
            <LifestyleChoice
              key={option.value}
              label={t(lifestyleLabelKey('personality', option.value))}
              icon={option.icon}
              selected={personality === option.value}
              onPress={() =>
                onPersonalityChange(
                  personality === option.value ? null : option.value,
                )
              }
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
                onWorkoutChange(workout === value ? null : value)
              }
            />
          ))}
        </View>
      </View>

      <Text style={[styles.footerHint, isComplete && styles.footerReady]}>
        {isComplete
          ? t('onboarding.lifestyle.readyHint')
          : t('onboarding.lifestyle.fillHint')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 22,
    paddingBottom: 24,
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
  footerHint: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSize(13),
    marginTop: 8,
  },
  footerReady: {
    color: homeAccent.purple,
  },
});
