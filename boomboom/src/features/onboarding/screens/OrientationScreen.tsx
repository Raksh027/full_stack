import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { images } from '@/assets';
import { RELATIONSHIP_GOAL_OPTIONS } from '@/features/profile/constants/profileOptions';
import type { RelationshipGoal } from '@/features/profile/types';
import { Icon, type IconName, ScreenContainer } from '@/shared/components';
import { colors, fontSize } from '@/theme';

import { OnboardingNextButton } from '../components/OnboardingNextButton';
import { useProfileStep } from '../hooks/useProfileStep';

const PILL_BLUE = '#3AA0FF';
const PILL_IDLE = '#2C2C32';

const GOAL_ICONS: Record<
  RelationshipGoal,
  { name: IconName; color: string }
> = {
  serious_love: { name: 'heart', color: '#E74C3C' },
  marriage: { name: 'diamond-outline', color: '#F2F2F2' },
  casual: { name: 'happy-outline', color: '#F4C430' },
  long_term: { name: 'sparkles', color: '#F4C430' },
  short_term: { name: 'hourglass-outline', color: '#D6C7B0' },
  travel_partner: { name: 'airplane', color: '#3B82F6' },
  new_friends: { name: 'people-outline', color: '#F4C430' },
  mutual_support: { name: 'people', color: '#3B82F6' },
  freelance: { name: 'woman-outline', color: '#F2F2F2' },
};

export function OrientationScreen() {
  const { t } = useTranslation();
  const { profile, isSaving, saveAndContinue } = useProfileStep();
  const [goal, setGoal] = useState<RelationshipGoal | null>(null);

  useEffect(() => {
    if (profile?.relationshipGoal) {
      setGoal(profile.relationshipGoal);
    }
  }, [profile?.relationshipGoal]);

  const handleNext = () => {
    if (!goal) {
      return;
    }
    saveAndContinue({ relationshipGoal: goal });
  };

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          {t('onboarding.relationshipGoal.title')}
        </Text>

        <View style={styles.note}>
          <Icon name="shield-checkmark" size={20} color="#3B82F6" />
          <Text style={styles.noteText}>
            {t('onboarding.relationshipGoal.note')}
          </Text>
        </View>

        <View accessibilityRole="radiogroup" style={styles.list}>
          {RELATIONSHIP_GOAL_OPTIONS.map(option => {
            const selected = goal === option.value;
            const visual = GOAL_ICONS[option.value];
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setGoal(option.value)}
                style={({ pressed }) => [
                  styles.row,
                  selected ? styles.rowOn : styles.rowOff,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.iconSlot}>
                  {option.value === 'freelance' ? (
                    <Image
                      source={images.freelanceGirl}
                      style={styles.customIcon}
                      resizeMode="contain"
                      tintColor="#F2F2F2"
                    />
                  ) : option.value === 'new_friends' ? (
                    <Image
                      source={images.friendshipHandshake}
                      style={styles.customIcon}
                      resizeMode="contain"
                    />
                  ) : (
                    <Icon name={visual.name} size={22} color={visual.color} />
                  )}
                </View>
                <View style={styles.copy}>
                  <Text style={styles.label}>
                    {t(
                      `profileOptions.relationshipGoal.${option.value}.title`,
                    )}
                  </Text>
                  <Text style={styles.hint}>
                    {t(
                      `profileOptions.relationshipGoal.${option.value}.description`,
                    )}
                  </Text>
                </View>
                <View style={[styles.radio, selected && styles.radioOn]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.safety}>
          <Icon name="shield-checkmark" size={18} color="#22C55E" />
          <Text style={styles.safetyText}>
            <Text style={styles.safetyStrong}>
              {t('onboarding.relationshipGoal.safety')}
            </Text>
            {'\n'}
            {t('onboarding.relationshipGoal.safetyHint')}
          </Text>
        </View>
      </ScrollView>

      <OnboardingNextButton
        onPress={handleNext}
        ready={Boolean(goal)}
        loading={isSaving}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 22,
  },
  scroll: {
    paddingTop: 8,
    paddingBottom: 12,
    gap: 14,
  },
  title: {
    fontSize: fontSize(34),
    lineHeight: 40,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.7,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PILL_IDLE,
  },
  noteText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fontSize(12),
    lineHeight: 17,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: colors.background,
  },
  rowOff: {
    borderColor: PILL_IDLE,
  },
  rowOn: {
    borderColor: PILL_BLUE,
  },
  rowPressed: {
    opacity: 0.82,
  },
  iconSlot: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customIcon: {
    width: 22,
    height: 22,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSize(16),
    fontWeight: '700',
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize(13),
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#8E8E93',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: '#F4C430',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F4C430',
  },
  safety: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PILL_IDLE,
  },
  safetyText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fontSize(13),
    lineHeight: 18,
  },
  safetyStrong: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
